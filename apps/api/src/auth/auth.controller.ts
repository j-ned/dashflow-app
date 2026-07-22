import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { DemoService } from '../modules/demo/demo.service';
import { StorageService } from '../storage/storage.service';
import { toPublicUser, toKeyMaterial } from './auth.response';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  sessionCookieOptions,
  csrfCookieOptions,
} from './cookie';
import {
  registerSchema,
  verifySchema,
  resendSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updatePasswordSchema,
  setPasswordSchema,
  totpVerifySchema,
  totpDisableSchema,
} from './dto/auth.dto';
import type {
  RegisterDto,
  VerifyDto,
  LoginDto,
  ResetPasswordDto,
  UpdatePasswordDto,
  SetPasswordDto,
  TotpVerifyDto,
  TotpDisableDto,
} from './dto/auth.dto';
import type { Env } from '../config/env.schema';
import { httpFrom } from './http-error';
import { STRICT_THROTTLE } from './throttle';

@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;
  private readonly demoEnabled: boolean;
  constructor(
    private readonly auth: AuthService,
    private readonly token: TokenService,
    private readonly demo: DemoService,
    private readonly storage: StorageService,
    config: ConfigService<Env, true>,
  ) {
    this.isProd = config.get('NODE_ENV', { infer: true }) === 'production';
    this.demoEnabled = config.get('DEMO_ENABLED', { infer: true });
  }

  private async setSession(
    res: Response,
    user: { id: string; email: string },
  ): Promise<void> {
    const jwt = await this.token.sign({ sub: user.id, email: user.email });
    res.cookie(SESSION_COOKIE, jwt, sessionCookieOptions(this.isProd));
  }

  @Throttle(STRICT_THROTTLE)
  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
  ) {
    const r = await this.auth.register(dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Compte créé, vérifiez votre email' };
  }

  @Throttle(STRICT_THROTTLE)
  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body(new ZodValidationPipe(verifySchema)) dto: VerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.verify(dto);
    if (!r.success) throw httpFrom(r);
    await this.setSession(res, r.data);
    return { user: toPublicUser(r.data), keyMaterial: toKeyMaterial(r.data) };
  }

  @Throttle(STRICT_THROTTLE)
  @Post('resend-code')
  @HttpCode(200)
  async resend(
    @Body(new ZodValidationPipe(resendSchema)) dto: { email: string },
  ) {
    await this.auth.resendCode(dto.email);
    return { message: 'Si le compte existe, un code a été envoyé' };
  }

  @Throttle(STRICT_THROTTLE)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.login(dto);
    if (!r.success) throw httpFrom(r);
    if (r.data.kind === 'mfa_required') return { mfaRequired: true };
    await this.setSession(res, r.data.user);
    return {
      user: toPublicUser(r.data.user),
      keyMaterial: toKeyMaterial(r.data.user),
    };
  }

  // Public demo session, gated by DEMO_ENABLED.
  @Throttle(STRICT_THROTTLE)
  @Post('demo-login')
  @HttpCode(200)
  async demoLogin(@Res({ passthrough: true }) res: Response) {
    if (!this.demoEnabled) throw new NotFoundException();
    const r = await this.auth.demoLogin();
    if (!r.success) throw httpFrom(r);
    await this.setSession(res, r.data);
    return { user: toPublicUser(r.data), keyMaterial: null };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Throttle(STRICT_THROTTLE)
  @Post('demo-reset')
  @HttpCode(200)
  async demoReset(@CurrentUser() u: AuthUser) {
    if (!this.demoEnabled) throw new NotFoundException();
    await this.demo.reset(u.id);
    return { message: 'Démo réinitialisée' };
  }

  @Throttle(STRICT_THROTTLE)
  @Post('forgot-password')
  @HttpCode(200)
  async forgot(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: { email: string },
  ) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'Si le compte existe, un code a été envoyé' };
  }

  @Throttle(STRICT_THROTTLE)
  @Post('reset-password')
  @HttpCode(200)
  async reset(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto,
  ) {
    const r = await this.auth.resetPassword(dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe réinitialisé' };
  }

  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existing = (req.cookies as Record<string, string>)?.[CSRF_COOKIE];
    const token = existing ?? randomBytes(32).toString('hex');
    if (!existing)
      res.cookie(CSRF_COOKIE, token, csrfCookieOptions(this.isProd));
    return { csrfToken: token };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    const user = await this.auth.getById(u.id);
    if (!user) throw new UnauthorizedException();
    return { ...toPublicUser(user), keyMaterial: toKeyMaterial(user) };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Patch('me')
  async updateProfile(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema))
    dto: { displayName?: string },
  ) {
    const user = await this.auth.updateProfile(u.id, dto.displayName);
    return { ...toPublicUser(user), keyMaterial: toKeyMaterial(user) };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Patch('me/password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(updatePasswordSchema)) dto: UpdatePasswordDto,
  ) {
    const r = await this.auth.changePassword(u.id, dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe mis à jour' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('me/set-password')
  @HttpCode(200)
  async setPassword(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(setPasswordSchema)) dto: SetPasswordDto,
  ) {
    const r = await this.auth.setPassword(u.id, dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe défini' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('me/2fa/setup')
  @HttpCode(200)
  async totpSetup(@CurrentUser() u: AuthUser) {
    const r = await this.auth.setupTotp(u.id);
    if (!r.success) throw httpFrom(r);
    return r.data;
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('me/2fa/verify')
  @HttpCode(200)
  async totpVerify(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(totpVerifySchema)) dto: TotpVerifyDto,
  ) {
    const r = await this.auth.enableTotp(u.id, dto.code);
    if (!r.success) throw httpFrom(r);
    return { message: '2FA activée', totpEnabled: true };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('me/2fa/disable')
  @HttpCode(200)
  async totpDisable(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(totpDisableSchema)) dto: TotpDisableDto,
  ) {
    const r = await this.auth.disableTotp(u.id, dto.password);
    if (!r.success) throw httpFrom(r);
    return { message: '2FA désactivée', totpEnabled: false };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Delete('me')
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() u: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const r = await this.auth.deleteAccount(u.id);
    if (!r.success) throw httpFrom(r);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.isProd));
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.isProd));
    return { message: 'Déconnecté' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async uploadAvatar(
    @CurrentUser() u: AuthUser,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
        file.mimetype,
      )
    ) {
      throw new BadRequestException('Type image invalide');
    }
    const key = this.storage.avatarKey(u.id, file.mimetype);
    await this.storage.upload(
      key,
      file.buffer,
      file.mimetype,
      'public, max-age=31536000, immutable',
    );
    const updated = await this.auth.setAvatar(u.id, key);
    return { ...toPublicUser(updated), keyMaterial: toKeyMaterial(updated) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('avatar/:userId')
  async getAvatar(
    @Param('userId') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.auth.getById(userId);
    if (!user?.avatarUrl) throw new NotFoundException('Avatar introuvable');
    const obj = await this.storage.getStream(user.avatarUrl);
    if (!obj) throw new NotFoundException('Avatar introuvable');
    res.setHeader('Content-Type', obj.contentType);
    obj.stream.pipe(res);
  }
}
