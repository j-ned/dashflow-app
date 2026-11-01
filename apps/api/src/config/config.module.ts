import { Global, Module } from '@nestjs/common';
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from '@nestjs/config';
import { ENV_KEYS, envSchema, type Env } from './env.schema';
import { ENV } from './env.token';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => envSchema.parse(raw),
    }),
  ],
  providers: [
    {
      // Valeurs validées (et transformées) par envSchema, telles que ConfigService les rend.
      provide: ENV,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Env =>
        Object.fromEntries(
          ENV_KEYS.map((key) => [key, config.get(key, { infer: true })]),
        ) as Env,
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
