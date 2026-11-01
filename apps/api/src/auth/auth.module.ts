import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { TokenService } from './token.service';
import { CsrfService } from './csrf.service';
import { TwoFactorService } from './two-factor.service';
import { SecretCipherService } from './secret-cipher.service';
import { EncryptionService } from './encryption.service';
import { EncryptionController } from './encryption.controller';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { UploadPolicy } from '../common/files/upload-policy';
import { DemoAccountGuard } from '../common/guards/demo-account.guard';
import { EmailThrottlerGuard } from '../common/guards/email-throttler.guard';
import { DemoModule } from '../modules/demo/demo.module';
import { SecurityEventsModule } from '../security-events/security-events.module';
import { StorageService } from '../storage/storage.service';
import { provideClass } from '../common/nest/provide-class';
import { DRIZZLE } from '../db/drizzle.constants';
import { ENV } from '../config/env.token';
import { MAILER } from '../mail/mailer';

@Module({
  imports: [DemoModule, SecurityEventsModule],
  controllers: [AuthController, EncryptionController, OAuthController],
  providers: [
    provideClass(
      AuthService,
      AuthRepository,
      MAILER,
      TwoFactorService,
      StorageService,
      SecretCipherService,
    ),
    provideClass(AuthRepository, DRIZZLE),
    provideClass(TokenService, ENV),
    provideClass(CsrfService, ENV),
    provideClass(TwoFactorService),
    provideClass(SecretCipherService, ENV),
    provideClass(EncryptionService, AuthRepository, DRIZZLE),
    provideClass(OAuthService, ENV, AuthRepository),
    JwtAuthGuard,
    CsrfGuard,
    DemoAccountGuard,
    EmailThrottlerGuard,
    provideClass(UploadPolicy, AuthRepository),
  ],
  exports: [
    TokenService,
    CsrfService,
    JwtAuthGuard,
    CsrfGuard,
    DemoAccountGuard,
    UploadPolicy,
  ],
})
export class AuthModule {}
