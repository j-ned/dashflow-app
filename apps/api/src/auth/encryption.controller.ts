import { Body, Controller, HttpCode, HttpException, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EncryptionService } from './encryption.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import {
  setupEncryptionKeysSchema, encryptionPassphraseSchema, migrateEncryptionSchema, resetWithRecoverySchema,
} from './dto/auth.dto';
import type { SetupEncryptionKeysDto, MigrateEncryptionDto, ResetWithRecoveryDto } from './dto/auth.dto';

const STRICT = { default: { limit: 10, ttl: 900_000 } };
function httpFrom(r: { status: number; error: string; code?: string }): HttpException {
  return new HttpException(r.code ? { message: r.error, code: r.code } : r.error, r.status);
}

@Controller('auth')
export class EncryptionController {
  constructor(private readonly enc: EncryptionService) {}

  @UseGuards(JwtAuthGuard, CsrfGuard) @Patch('me/encryption-keys') @HttpCode(200)
  async setKeys(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(setupEncryptionKeysSchema)) dto: SetupEncryptionKeysDto) {
    await this.enc.setKeys(u.id, dto);
    return { message: 'Clés de chiffrement configurées' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/encryption-passphrase') @HttpCode(200)
  async setPassphrase(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(encryptionPassphraseSchema)) _dto: { passphrase: string }) {
    await this.enc.setPassphrase(u.id);
    return { message: 'Passphrase de chiffrement définie' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/migrate-encryption') @HttpCode(200)
  async migrate(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(migrateEncryptionSchema)) dto: MigrateEncryptionDto) {
    await this.enc.migrate(u.id, dto);
    return { message: 'Migration chiffrement terminée' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/wipe-encryption') @HttpCode(200)
  async wipe(@CurrentUser() u: AuthUser) {
    await this.enc.wipe(u.id);
    return { message: 'Données chiffrées supprimées' };
  }

  @Throttle(STRICT) @Post('reset-password-with-recovery') @HttpCode(200)
  async resetWithRecovery(@Body(new ZodValidationPipe(resetWithRecoverySchema)) dto: ResetWithRecoveryDto) {
    const r = await this.enc.resetPasswordWithRecovery(dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe réinitialisé avec succès' };
  }
}
