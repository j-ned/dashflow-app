import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
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
import type { Env } from '../config/env.schema';

export const JWT_ISSUER = 'dashflow-api';
export const JWT_AUDIENCE = 'dashflow-web';

@Module({
  imports: [
    DemoModule,
    SecurityEventsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService<Env, true>) => ({
        secret: c.get('JWT_SECRET', { infer: true }),
        // Algorithme et audience explicites : un token signé autrement (ou pour un autre
        // service partageant le secret) est refusé. Les tokens antérieurs à ce changement
        // (sans iss/aud) deviennent invalides : reconnexion unique.
        signOptions: {
          expiresIn: '7d',
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
      }),
    }),
  ],
  controllers: [AuthController, EncryptionController, OAuthController],
  providers: [
    AuthService,
    AuthRepository,
    TokenService,
    CsrfService,
    TwoFactorService,
    SecretCipherService,
    EncryptionService,
    OAuthService,
    JwtAuthGuard,
    CsrfGuard,
    DemoAccountGuard,
    EmailThrottlerGuard,
    UploadPolicy,
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
