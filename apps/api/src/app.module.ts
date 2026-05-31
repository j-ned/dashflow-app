import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule, DrizzleModule, HealthModule],
})
export class AppModule {}
