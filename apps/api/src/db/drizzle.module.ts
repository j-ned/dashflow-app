import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DRIZZLE } from './drizzle.constants';
import type { Env } from '../config/env.schema';

const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        postgres(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DRIZZLE,
      inject: [POSTGRES_CLIENT],
      useFactory: (sql: ReturnType<typeof postgres>) =>
        drizzle(sql, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
