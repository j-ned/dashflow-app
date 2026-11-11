import type { Context } from 'hono';
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import {
  MFA_PROOF_REJECTED,
  requiresSecondFactor,
} from '../../auth/auth.service';
import {
  OAUTH_MFA_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  oauthCookieOptions,
  oauthMfaCookieOptions,
} from '../../auth/cookie';
import { oauthMfaSchema } from '../../auth/dto/auth.dto';
import {
  MFA_PENDING_TTL_SECONDS,
  type MfaPendingPayload,
} from '../../auth/token.service';
import { AppError } from '../../common/errors';
import { servesOverHttps } from '../../config/env.schema';
import type { HttpDeps } from '../deps';
import { clearAppCookie, clientOf, resultError, setAppCookie } from '../kit';
import {
  STRICT_THROTTLE,
  throttle,
  throttleByAccount,
} from '../middleware/rate-limit';
import type { AppEnv } from '../types';
import { jsonBody } from '../validate';

/** Routes /auth/oauth/google (contrôleur Nest OAuthController). */
export function oauthRoutes(d: HttpDeps) {
  const isProd = servesOverHttps(d.env);
  const frontUrl = d.env.CORS_ORIGIN.split(',')[0];
  const strict = throttle(STRICT_THROTTLE);
  // Calculé à l'usage : APP_URL n'est lu que par les routes Google, pas au montage de l'app.
  const mfaCookie = () =>
    oauthMfaCookieOptions(
      isProd,
      d.env.APP_URL,
      MFA_PENDING_TTL_SECONDS * 1000,
    );

  /** Preuve en attente portée par le cookie, ou `undefined` si absente, expirée ou falsifiée. */
  const pendingProof = async (
    c: Context<AppEnv>,
  ): Promise<MfaPendingPayload | undefined> => {
    const raw = getCookie(c, OAUTH_MFA_COOKIE);
    if (!raw) return undefined;
    // Jeton illisible = pas de preuve : la route répond 401 et vide le cookie.
    return d.tokens.verifyMfaPending(raw).catch(() => undefined);
  };
  // Pas d'e-mail dans le corps : le compteur par compte se cale sur le compte de la preuve.
  const byAccount = throttleByAccount(
    d.rateLimits,
    STRICT_THROTTLE,
    async (c) => (await pendingProof(c))?.sub,
  );

  return (
    new Hono<AppEnv>()
      .get('/', strict, async (c) => {
        const { url, state, codeVerifier } =
          await d.oauth.createAuthorization();
        setAppCookie(c, OAUTH_STATE_COOKIE, state, oauthCookieOptions(isProd));
        setAppCookie(
          c,
          OAUTH_VERIFIER_COOKIE,
          codeVerifier,
          oauthCookieOptions(isProd),
        );
        return c.redirect(url, 302);
      })

      .get('/callback', strict, async (c) => {
        const code = c.req.query('code');
        const state = c.req.query('state');
        const cookieState = getCookie(c, OAUTH_STATE_COOKIE);
        const codeVerifier = getCookie(c, OAUTH_VERIFIER_COOKIE);
        clearAppCookie(c, OAUTH_STATE_COOKIE, oauthCookieOptions(isProd));
        clearAppCookie(c, OAUTH_VERIFIER_COOKIE, oauthCookieOptions(isProd));

        if (
          !code ||
          !state ||
          !cookieState ||
          !codeVerifier ||
          state !== cookieState
        )
          return c.redirect(`${frontUrl}/auth/login?error=oauth_expired`, 302);
        try {
          const profile = await d.oauth.fetchGoogleUser(code, codeVerifier);
          const user = await d.oauth.findOrCreateGoogleUser(profile);
          if (requiresSecondFactor(user)) {
            // Google ne remplace que le mot de passe. Aucune session tant que le second facteur
            // n'est pas passé : seule une preuve de courte durée part, en cookie HttpOnly.
            const proof = await d.tokens.signMfaPending({
              sub: user.id,
              sv: user.sessionVersion,
            });
            setAppCookie(c, OAUTH_MFA_COOKIE, proof, mfaCookie());
            return c.redirect(`${frontUrl}/auth/login?oauth=mfa`, 302);
          }
          // Cookie de session seul : le front relit la session (et son jeton CSRF) au retour.
          await d.sessionCookies.open(c, user);
          await d.securityEvents.record('login_oauth', user.id, clientOf(c));
          return c.redirect(`${frontUrl}/auth/login?oauth=success`, 302);
        } catch (err) {
          const reason =
            err instanceof Error && err.message === 'oauth_no_email'
              ? 'oauth_no_email'
              : 'oauth_failed';
          return c.redirect(`${frontUrl}/auth/login?error=${reason}`, 302);
        }
      })

      /**
       * Seconde étape d'une connexion Google sur un compte 2FA. Avant session, comme /auth/login :
       * même throttling (IP + compte), pas de jeton CSRF (il n'y a pas encore de session), corps
       * lu seulement s'il est déclaré JSON.
       * La preuve n'est pas à usage unique côté serveur, et n'a pas besoin de l'être : chaque essai
       * exige un code TOTP que l'anti-rejeu n'accepte qu'une fois, ou un code de secours consommé
       * à l'usage ; elle est vidée au succès, expire en 5 minutes et meurt avec la version de
       * session du compte.
       */
      .post('/mfa', strict, byAccount, async (c) => {
        const proof = await pendingProof(c);
        if (!proof) {
          clearAppCookie(c, OAUTH_MFA_COOKIE, mfaCookie());
          throw new AppError(401, 'Connexion expirée', MFA_PROOF_REJECTED);
        }
        const dto = await jsonBody(c, oauthMfaSchema);
        const r = await d.auth.completeSecondFactor(
          { userId: proof.sub, sessionVersion: proof.sv },
          dto.totpCode,
        );
        if (!r.success) {
          // Mauvais code : la preuve reste valable pour un nouvel essai. Preuve périmée : on la retire.
          if (r.code === MFA_PROOF_REJECTED)
            clearAppCookie(c, OAUTH_MFA_COOKIE, mfaCookie());
          else
            await d.securityEvents.record(
              'login_failed',
              proof.sub,
              clientOf(c),
            );
          throw resultError(r);
        }
        clearAppCookie(c, OAUTH_MFA_COOKIE, mfaCookie());
        // Cookie de session seul, comme le retour Google sans 2FA : le front relit la session.
        await d.sessionCookies.open(c, r.data.user);
        await d.securityEvents.record('login_oauth', proof.sub, clientOf(c));
        if (r.data.backupCodesRemaining === undefined)
          return c.json({ message: 'Connecté' });
        await d.securityEvents.record(
          'backup_code_used',
          proof.sub,
          clientOf(c),
        );
        return c.json({
          message: 'Connecté',
          backupCodesRemaining: r.data.backupCodesRemaining,
        });
      })
  );
}
