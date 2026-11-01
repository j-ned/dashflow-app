import { Module } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';
import { SecurityEventsInterceptor } from './security-events.interceptor';
import { provideClass } from '../common/nest/provide-class';
import { DRIZZLE } from '../db/drizzle.constants';

@Module({
  providers: [
    provideClass(SecurityEventsService, DRIZZLE),
    SecurityEventsInterceptor,
  ],
  exports: [SecurityEventsService, SecurityEventsInterceptor],
})
export class SecurityEventsModule {}
