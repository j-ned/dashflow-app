import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { TokenService } from './token.service';
import {
  SESSION_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE,
  sessionCookieOptions, oauthCookieOptions,
} from './cookie';
import { STRICT_THROTTLE } from './throttle';
import type { Env } from '../config/env.schema';

@Controller('auth/oauth/google')
export class OAuthController {
  private readonly isProd: boolean;
  private readonly frontUrl: string;
  constructor(
    private readonly oauth: OAuthService,
    private readonly token: TokenService,
    config: ConfigService<Env, true>,
  ) {
    this.isProd = config.get('NODE_ENV', { infer: true }) === 'production';
    this.frontUrl = config.get('CORS_ORIGIN', { infer: true }).split(',')[0];
  }

  @Throttle(STRICT_THROTTLE)
  @Get()
  start(@Res({ passthrough: true }) res: Response): void {
    const { url, state, codeVerifier } = this.oauth.createAuthorization();
    res.cookie(OAUTH_STATE_COOKIE, state, oauthCookieOptions(this.isProd));
    res.cookie(OAUTH_VERIFIER_COOKIE, codeVerifier, oauthCookieOptions(this.isProd));
    res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookies = (req.cookies ?? {}) as Record<string, string>;
    const cookieState = cookies[OAUTH_STATE_COOKIE];
    const codeVerifier = cookies[OAUTH_VERIFIER_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, oauthCookieOptions(this.isProd));
    res.clearCookie(OAUTH_VERIFIER_COOKIE, oauthCookieOptions(this.isProd));

    if (!code || !state || !cookieState || !codeVerifier || state !== cookieState) {
      res.redirect(`${this.frontUrl}/auth/login?error=oauth_expired`);
      return;
    }
    try {
      const profile = await this.oauth.fetchGoogleUser(code, codeVerifier);
      const user = await this.oauth.findOrCreateGoogleUser(profile);
      const jwt = await this.token.sign({ sub: user.id, email: user.email });
      res.cookie(SESSION_COOKIE, jwt, sessionCookieOptions(this.isProd));
      res.redirect(`${this.frontUrl}/auth/login?oauth=success`);
    } catch (err) {
      const reason = err instanceof Error && err.message === 'oauth_no_email' ? 'oauth_no_email' : 'oauth_failed';
      res.redirect(`${this.frontUrl}/auth/login?error=${reason}`);
    }
  }
}
