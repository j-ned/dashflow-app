import {
  Body, Controller, Get, HttpCode, HttpException, Patch, Post, Req, Res, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { toPublicUser, toKeyMaterial } from './auth.response';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { SESSION_COOKIE, CSRF_COOKIE, sessionCookieOptions, csrfCookieOptions } from './cookie';
import {
  registerSchema, verifySchema, resendSchema, loginSchema, forgotPasswordSchema,
  resetPasswordSchema, updateProfileSchema, updatePasswordSchema, setPasswordSchema,
  totpVerifySchema, totpDisableSchema,
} from './dto/auth.dto';
import type {
  RegisterDto, VerifyDto, LoginDto, ResetPasswordDto, UpdatePasswordDto, SetPasswordDto,
  TotpVerifyDto, TotpDisableDto,
} from './dto/auth.dto';
import type { Env } from '../config/env.schema';

const STRICT = { default: { limit: 10, ttl: 900_000 } };

function httpFrom(r: { status: number; error: string; code?: string }): HttpException {
  return new HttpException(r.code ? { message: r.error, code: r.code } : r.error, r.status);
}

@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;
  constructor(
    private readonly auth: AuthService,
    private readonly token: TokenService,
    config: ConfigService<Env, true>,
  ) { this.isProd = config.get('NODE_ENV', { infer: true }) === 'production'; }

  private async setSession(res: Response, user: { id: string; email: string }): Promise<void> {
    const jwt = await this.token.sign({ sub: user.id, email: user.email });
    res.cookie(SESSION_COOKIE, jwt, sessionCookieOptions(this.isProd));
  }

  @Throttle(STRICT) @Post('register') @HttpCode(201)
  async register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto) {
    const r = await this.auth.register(dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Compte créé, vérifiez votre email' };
  }

  @Throttle(STRICT) @Post('verify') @HttpCode(200)
  async verify(@Body(new ZodValidationPipe(verifySchema)) dto: VerifyDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.verify(dto);
    if (!r.success) throw httpFrom(r);
    await this.setSession(res, r.data);
    return { user: toPublicUser(r.data), keyMaterial: toKeyMaterial(r.data) };
  }

  @Throttle(STRICT) @Post('resend-code') @HttpCode(200)
  async resend(@Body(new ZodValidationPipe(resendSchema)) dto: { email: string }) {
    await this.auth.resendCode(dto.email);
    return { message: 'Si le compte existe, un code a été envoyé' };
  }

  @Throttle(STRICT) @Post('login') @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.login(dto);
    if (!r.success) throw httpFrom(r);
    await this.setSession(res, r.data);
    return { user: toPublicUser(r.data), keyMaterial: toKeyMaterial(r.data) };
  }

  @Throttle(STRICT) @Post('forgot-password') @HttpCode(200)
  async forgot(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: { email: string }) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'Si le compte existe, un code a été envoyé' };
  }

  @Throttle(STRICT) @Post('reset-password') @HttpCode(200)
  async reset(@Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto) {
    const r = await this.auth.resetPassword(dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe réinitialisé' };
  }

  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existing = (req.cookies as Record<string, string>)?.[CSRF_COOKIE];
    const token = existing ?? randomBytes(32).toString('hex');
    if (!existing) res.cookie(CSRF_COOKIE, token, csrfCookieOptions(this.isProd));
    return { csrfToken: token };
  }

  @UseGuards(JwtAuthGuard) @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    const user = await this.auth.getById(u.id);
    if (!user) throw new UnauthorizedException();
    return { user: toPublicUser(user), keyMaterial: toKeyMaterial(user) };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Patch('me')
  async updateProfile(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(updateProfileSchema)) dto: { displayName?: string }) {
    const user = await this.auth.updateProfile(u.id, dto.displayName);
    return { user: toPublicUser(user), keyMaterial: toKeyMaterial(user) };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Patch('me/password') @HttpCode(200)
  async changePassword(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(updatePasswordSchema)) dto: UpdatePasswordDto) {
    const r = await this.auth.changePassword(u.id, dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe mis à jour' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/set-password') @HttpCode(200)
  async setPassword(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(setPasswordSchema)) dto: SetPasswordDto) {
    const r = await this.auth.setPassword(u.id, dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe défini' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/2fa/setup') @HttpCode(200)
  async totpSetup(@CurrentUser() u: AuthUser) {
    const r = await this.auth.setupTotp(u.id);
    if (!r.success) throw httpFrom(r);
    return r.data;
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/2fa/verify') @HttpCode(200)
  async totpVerify(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(totpVerifySchema)) dto: TotpVerifyDto) {
    const r = await this.auth.enableTotp(u.id, dto.code);
    if (!r.success) throw httpFrom(r);
    return { message: '2FA activée', totpEnabled: true };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/2fa/disable') @HttpCode(200)
  async totpDisable(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(totpDisableSchema)) dto: TotpDisableDto) {
    const r = await this.auth.disableTotp(u.id, dto.password);
    if (!r.success) throw httpFrom(r);
    return { message: '2FA désactivée', totpEnabled: false };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('logout') @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.isProd));
    return { message: 'Déconnecté' };
  }
}
