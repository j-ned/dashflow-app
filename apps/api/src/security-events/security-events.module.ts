import { Module } from '@nestjs/common';
import { SecurityEventsService } from './security-events.service';
import { SecurityEventsInterceptor } from './security-events.interceptor';

@Module({
  providers: [SecurityEventsService, SecurityEventsInterceptor],
  exports: [SecurityEventsService, SecurityEventsInterceptor],
})
export class SecurityEventsModule {}
