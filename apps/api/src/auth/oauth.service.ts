import { Google, generateState, generateCodeVerifier } from 'arctic';
import { AuthRepository } from './auth.repository';
import type { Env } from '../config/env.schema';
import type { users } from '../db/schema';
import { InternalError } from '../common/errors';

type User = typeof users.$inferSelect;
export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
}

export class OAuthService {
  constructor(
    private readonly config: Pick<
      Env,
      'APP_URL' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'
    >,
    private readonly repo: AuthRepository,
  ) {}

  private google(): Google {
    const clientId = this.config.GOOGLE_CLIENT_ID;
    const clientSecret = this.config.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new InternalError('Google OAuth non configuré');
    const redirectUri = `${this.config.APP_URL}/auth/oauth/google/callback`;
    return new Google(clientId, clientSecret, redirectUri);
  }

  createAuthorization(): { url: string; state: string; codeVerifier: string } {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = this.google().createAuthorizationURL(state, codeVerifier, [
      'openid',
      'email',
      'profile',
    ]);
    return { url: url.toString(), state, codeVerifier };
  }

  async fetchGoogleUser(
    code: string,
    codeVerifier: string,
  ): Promise<GoogleProfile> {
    const tokens = await this.google().validateAuthorizationCode(
      code,
      codeVerifier,
    );
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    if (!res.ok) throw new Error('oauth_userinfo_failed');
    const p = (await res.json()) as {
      id?: string;
      email?: string;
      verified_email?: boolean;
      name?: string;
    };
    if (!p.id) throw new Error('oauth_no_id');
    if (!p.email) throw new Error('oauth_no_email');
    // Un e-mail non vérifié chez Google ne prouve rien : refuser plutôt que lier un compte.
    if (p.verified_email !== true) throw new Error('oauth_email_unverified');
    return {
      googleId: p.id,
      email: p.email.toLowerCase(),
      displayName: p.name ?? p.email.split('@')[0],
    };
  }

  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
    const byGoogle = await this.repo.findByGoogleId(profile.googleId);
    if (byGoogle) return byGoogle;
    const byEmail = await this.repo.findByEmail(profile.email);
    if (byEmail) {
      if (byEmail.emailVerified) {
        return this.repo.updateUser(byEmail.id, { googleId: profile.googleId });
      }
      // Compte créé par /auth/register mais jamais vérifié : il n'appartient à personne.
      // Le laisser tel quel permettrait à celui qui l'a créé (avec SON mot de passe) de se
      // connecter sur le compte de la personne qui vient de prouver l'e-mail via Google
      // (pre-account-takeover). On neutralise tout credential préexistant.
      return this.repo.updateUser(byEmail.id, {
        googleId: profile.googleId,
        password: null,
        totpSecret: null,
        totpEnabled: null,
        displayName: profile.displayName,
        emailVerified: new Date(),
      });
    }
    const created = await this.repo.createUser({
      email: profile.email,
      password: null,
      displayName: profile.displayName,
    });
    return this.repo.updateUser(created.id, {
      googleId: profile.googleId,
      emailVerified: new Date(),
    });
  }
}
