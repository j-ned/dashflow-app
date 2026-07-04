import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Google, generateState, generateCodeVerifier } from 'arctic';
import { AuthRepository } from './auth.repository';
import type { Env } from '../config/env.schema';
import type { users } from '../db/schema';

type User = typeof users.$inferSelect;
export interface GoogleProfile {
  googleId: string;
  email: string;
  displayName: string;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly repo: AuthRepository,
  ) {}

  private google(): Google {
    const clientId = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET', {
      infer: true,
    });
    if (!clientId || !clientSecret)
      throw new InternalServerErrorException('Google OAuth non configuré');
    const redirectUri = `${this.config.get('APP_URL', { infer: true })}/auth/oauth/google/callback`;
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
    const p = (await res.json()) as {
      id: string;
      email?: string;
      name?: string;
    };
    if (!p.email) throw new Error('oauth_no_email');
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
      return this.repo.updateUser(byEmail.id, {
        googleId: profile.googleId,
        emailVerified: byEmail.emailVerified ?? new Date(),
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
