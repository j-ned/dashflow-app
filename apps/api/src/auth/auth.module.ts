import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';
import { EncryptionService } from './encryption.service';
import { EncryptionController } from './encryption.controller';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import type { Env } from '../config/env.schema';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService<Env, true>) => ({
        secret: c.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController, EncryptionController, OAuthController],
  providers: [AuthService, AuthRepository, TokenService, TwoFactorService, EncryptionService, OAuthService],
})
export class AuthModule {}
