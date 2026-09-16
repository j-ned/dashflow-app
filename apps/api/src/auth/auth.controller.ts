import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { CsrfService } from './csrf.service';
import { SecurityEvent } from '../security-events/security-event.decorator';
import { SecurityEventsInterceptor } from '../security-events/security-events.interceptor';
import { SecurityEventsService } from '../security-events/security-events.service';
import { DemoService } from '../modules/demo/demo.service';
import { StorageService } from '../storage/storage.service';
import { toPublicUser, toKeyMaterial } from './auth.response';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { DemoAccountGuard } from '../common/guards/demo-account.guard';
import { EmailThrottlerGuard } from '../common/guards/email-throttler.guard';
import { assertValidImageUpload } from '../common/files/validate-upload';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  SESSION_COOKIE_NAMES,
  sessionCookieName,
  sessionCookieOptions,
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
  backupCodesRegenerateSchema,
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
  BackupCodesRegenerateDto,
} from './dto/auth.dto';
import type { Env } from '../config/env.schema';
import { httpFrom } from './http-error';
import { STRICT_THROTTLE } from './throttle';

@Controller('auth')
@UseInterceptors(SecurityEventsInterceptor)
export class AuthController {
  private readonly isProd: boolean;
  private readonly demoEnabled: boolean;
  constructor(
    private readonly auth: AuthService,
    private readonly token: TokenService,
    private readonly csrfTokens: CsrfService,
    private readonly securityEvents: SecurityEventsService,
    private readonly demo: DemoService,
    private readonly storage: StorageService,
    config: ConfigService<Env, true>,
  ) {
    this.isProd = config.get('NODE_ENV', { infer: true }) === 'production';
    this.demoEnabled = config.get('DEMO_ENABLED', { infer: true });
  }

  /** Pose le cookie de session et renvoie le jeton CSRF de cette session (à inclure dans la réponse). */
  private async setSession(
    res: Response,
    user: { id: string; email: string; sessionVersion: number },
    opts: { demo?: boolean } = {},
  ): Promise<string> {
    const jwt = await this.token.sign({
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
      ...(opts.demo ? { demo: true } : {}),
    });
    res.cookie(
      sessionCookieName(this.isProd),
      jwt,
      sessionCookieOptions(this.isProd),
    );
    return this.csrfTokens.tokenFor(user.id, user.sessionVersion);
  }

  private clearSession(res: Response): void {
    for (const name of SESSION_COOKIE_NAMES) {
      res.clearCookie(name, sessionCookieOptions(this.isProd));
    }
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

  @UseGuards(EmailThrottlerGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'email_verified' })
  @Post('verify')
  @HttpCode(200)
  async verify(
    @Body(new ZodValidationPipe(verifySchema)) dto: VerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.verify(dto);
    if (!r.success) throw httpFrom(r);
    const csrfToken = await this.setSession(res, r.data);
    return {
      user: toPublicUser(r.data),
      keyMaterial: toKeyMaterial(r.data),
      csrfToken,
    };
  }

  @UseGuards(EmailThrottlerGuard)
  @Throttle(STRICT_THROTTLE)
  @Post('resend-code')
  @HttpCode(200)
  async resend(
    @Body(new ZodValidationPipe(resendSchema)) dto: { email: string },
  ) {
    await this.auth.resendCode(dto.email);
    return { message: 'Si le compte existe, un code a été envoyé' };
  }

  @UseGuards(EmailThrottlerGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'login_success', failure: 'login_failed' })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.login(dto);
    if (!r.success) throw httpFrom(r);
    if (r.data.kind === 'mfa_required') return { mfaRequired: true };
    const csrfToken = await this.setSession(res, r.data.user);
    return {
      user: toPublicUser(r.data.user),
      keyMaterial: toKeyMaterial(r.data.user),
      csrfToken,
      // Présent seulement si la connexion a consommé un code de secours : le front prévient.
      ...(r.data.backupCodesRemaining !== undefined
        ? { backupCodesRemaining: r.data.backupCodesRemaining }
        : {}),
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
    const csrfToken = await this.setSession(res, r.data, { demo: true });
    return { user: toPublicUser(r.data), keyMaterial: null, csrfToken };
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

  @UseGuards(EmailThrottlerGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'password_reset_requested' })
  @Post('forgot-password')
  @HttpCode(200)
  async forgot(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: { email: string },
  ) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'Si le compte existe, un code a été envoyé' };
  }

  @UseGuards(EmailThrottlerGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'password_reset' })
  @Post('reset-password')
  @HttpCode(200)
  async reset(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto,
  ) {
    const r = await this.auth.resetPassword(dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe réinitialisé' };
  }

  /** Jeton CSRF de la session courante (HMAC, sans cookie) : 401 sans session. */
  @UseGuards(JwtAuthGuard)
  @Get('csrf')
  csrf(@CurrentUser() u: AuthUser) {
    return { csrfToken: this.csrfTokens.tokenFor(u.id, u.sessionVersion) };
  }

  @UseGuards(JwtAuthGuard)
  /** Activité récente du compte (connexions, changements sensibles), la plus récente d'abord. */
  @UseGuards(JwtAuthGuard)
  @Get('me/security-events')
  securityEventsList(
    @CurrentUser() u: AuthUser,
    @Query('limit') limit?: string,
  ) {
    const n = Number(limit);
    return this.securityEvents.listFor(
      u.id,
      Number.isInteger(n) && n > 0 ? n : 50,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    const user = await this.auth.getById(u.id);
    if (!user) throw new UnauthorizedException();
    return { ...toPublicUser(user), keyMaterial: toKeyMaterial(user) };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Patch('me')
  async updateProfile(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema))
    dto: { displayName?: string },
  ) {
    const user = await this.auth.updateProfile(u.id, dto.displayName);
    return { ...toPublicUser(user), keyMaterial: toKeyMaterial(user) };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'password_changed' })
  @Patch('me/password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(updatePasswordSchema)) dto: UpdatePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.changePassword(u.id, dto);
    if (!r.success) throw httpFrom(r);
    // Les autres appareils sont déconnectés ; celui-ci reçoit un cookie à jour.
    await this.setSession(res, r.data);
    return { message: 'Mot de passe mis à jour' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'password_set' })
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

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Throttle(STRICT_THROTTLE)
  @Post('me/2fa/setup')
  @HttpCode(200)
  async totpSetup(@CurrentUser() u: AuthUser) {
    const r = await this.auth.setupTotp(u.id);
    if (!r.success) throw httpFrom(r);
    return r.data;
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'totp_enabled' })
  @Post('me/2fa/verify')
  @HttpCode(200)
  async totpVerify(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(totpVerifySchema)) dto: TotpVerifyDto,
  ) {
    const r = await this.auth.enableTotp(u.id, dto.code);
    if (!r.success) throw httpFrom(r);
    // Les codes de secours ne sont montrés qu'ici, une fois ; seul leur HMAC est conservé.
    return {
      message: '2FA activée',
      totpEnabled: true,
      backupCodes: r.data.backupCodes,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/2fa/backup-codes')
  async backupCodesStatus(@CurrentUser() u: AuthUser) {
    const r = await this.auth.backupCodesStatus(u.id);
    if (!r.success) throw httpFrom(r);
    return r.data;
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'backup_codes_regenerated' })
  @Post('me/2fa/backup-codes')
  @HttpCode(200)
  async backupCodesRegenerate(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(backupCodesRegenerateSchema))
    dto: BackupCodesRegenerateDto,
  ) {
    const r = await this.auth.regenerateBackupCodes(u.id, dto.password);
    if (!r.success) throw httpFrom(r);
    return { backupCodes: r.data.backupCodes };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'totp_disabled' })
  @Post('me/2fa/disable')
  @HttpCode(200)
  async totpDisable(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(totpDisableSchema)) dto: TotpDisableDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.disableTotp(u.id, dto.password);
    if (!r.success) throw httpFrom(r);
    await this.setSession(res, r.data);
    return { message: '2FA désactivée', totpEnabled: false };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Delete('me')
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() u: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const r = await this.auth.deleteAccount(u.id);
    if (!r.success) throw httpFrom(r);
    this.clearSession(res);
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @SecurityEvent({ success: 'logout' })
  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() u: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.revokeSessions(u.id);
    this.clearSession(res);
    return { message: 'Déconnecté' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  async uploadAvatar(
    @CurrentUser() u: AuthUser,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    await assertValidImageUpload(file);
    // Un changement de format (png → jpg) change la clé : purge l'ancien objet, sinon il reste
    // public et immuable dans R2 pour toujours.
    await this.storage.deletePrefix(`avatars/${u.id}.`);
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
    @Param('userId', ParseUUIDPipe) userId: string,
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
