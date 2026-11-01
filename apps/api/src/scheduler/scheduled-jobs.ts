import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SecurityEventsService } from '../security-events/security-events.service';
import { AdminService } from '../modules/admin/admin.service';
import { DemoService } from '../modules/demo/demo.service';

/**
 * Seul endroit qui planifie les tâches de fond. Les services exposent des méthodes simples ;
 * l'horloge (ici @nestjs/schedule) reste un détail du framework, interchangeable.
 */
@Injectable()
export class ScheduledJobs {
  constructor(
    private readonly securityEvents: SecurityEventsService,
    private readonly admin: AdminService,
    private readonly demo: DemoService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  purgeOldSecurityEvents(): Promise<void> {
    return this.securityEvents.purgeOld();
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  purgeStaleUnverifiedAccounts(): Promise<void> {
    return this.admin.purgeStaleUnverified();
  }

  // No-op si DEMO_ENABLED=false (vérifié par DemoService).
  @Cron(CronExpression.EVERY_6_HOURS)
  resetDemoAccount(): Promise<void> {
    return this.demo.scheduledReset();
  }
}
