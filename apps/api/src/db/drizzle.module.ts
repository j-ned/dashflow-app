import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
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
export class DrizzleModule implements OnApplicationShutdown {
  constructor(
    @Inject(POSTGRES_CLIENT)
    private readonly client: ReturnType<typeof postgres>,
  ) {}

  // Rend les connexions à Postgres au lieu de les laisser tomber à la mort du processus.
  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
