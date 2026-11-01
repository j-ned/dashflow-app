import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  oauthCookieOptions,
} from '../../auth/cookie';
import type { HttpDeps } from '../deps';
import { clearAppCookie, clientOf, setAppCookie } from '../kit';
import { STRICT_THROTTLE, throttle } from '../middleware/rate-limit';
import type { AppEnv } from '../types';

/** Routes /auth/oauth/google (contrôleur Nest OAuthController). */
export function oauthRoutes(d: HttpDeps) {
  const isProd = d.env.NODE_ENV === 'production';
  const frontUrl = d.env.CORS_ORIGIN.split(',')[0];
  const strict = throttle(STRICT_THROTTLE);

  return new Hono<AppEnv>()
    .get('/', strict, (c) => {
      const { url, state, codeVerifier } = d.oauth.createAuthorization();
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
    });
}
