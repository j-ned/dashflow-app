import {
  Body,
  Controller,
  HttpCode,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EncryptionService } from './encryption.service';
import { SecurityEvent } from '../security-events/security-event.decorator';
import { SecurityEventsInterceptor } from '../security-events/security-events.interceptor';
import { httpFrom } from './http-error';
import { STRICT_THROTTLE } from './throttle';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { EmailThrottlerGuard } from '../common/guards/email-throttler.guard';
import { DemoAccountGuard } from '../common/guards/demo-account.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import {
  setupEncryptionKeysSchema,
  migrateEncryptionSchema,
  resetWithRecoverySchema,
} from './dto/auth.dto';
import type {
  SetupEncryptionKeysDto,
  MigrateEncryptionDto,
  ResetWithRecoveryDto,
} from './dto/auth.dto';

@Controller('auth')
@UseInterceptors(SecurityEventsInterceptor)
export class EncryptionController {
  constructor(private readonly enc: EncryptionService) {}

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @SecurityEvent({ success: 'encryption_keys_set' })
  @Patch('me/encryption-keys')
  @HttpCode(200)
  async setKeys(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(setupEncryptionKeysSchema))
    dto: SetupEncryptionKeysDto,
  ) {
    const r = await this.enc.setKeys(u.id, dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Clés de chiffrement configurées' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @Post('me/encryption-passphrase')
  @HttpCode(200)
  async setPassphrase(@CurrentUser() u: AuthUser) {
    // Ne pose qu'un indicateur : la passphrase elle-même ne quitte jamais le client.
    await this.enc.setPassphrase(u.id);
    return { message: 'Passphrase de chiffrement définie' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard, DemoAccountGuard)
  @SecurityEvent({ success: 'encryption_migrated' })
  @Post('me/migrate-encryption')
  @HttpCode(200)
  async migrate(
    @CurrentUser() u: AuthUser,
    @Body(new ZodValidationPipe(migrateEncryptionSchema))
    dto: MigrateEncryptionDto,
  ) {
    const r = await this.enc.migrate(u.id, dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Migration chiffrement terminée' };
  }

  @UseGuards(EmailThrottlerGuard)
  @Throttle(STRICT_THROTTLE)
  @SecurityEvent({ success: 'recovery_reset' })
  @Post('reset-password-with-recovery')
  @HttpCode(200)
  async resetWithRecovery(
    @Body(new ZodValidationPipe(resetWithRecoverySchema))
    dto: ResetWithRecoveryDto,
  ) {
    const r = await this.enc.resetPasswordWithRecovery(dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe réinitialisé avec succès' };
  }
}
