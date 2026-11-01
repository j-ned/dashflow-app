import { describe, it, expect } from 'vitest';
import { CronExpression } from '@nestjs/schedule';
import { SCHEDULED_JOBS } from './scheduler';

describe('Tâches planifiées Hono', () => {
  it('mêmes horaires que les @Cron de ScheduledJobs (Nest)', () => {
    expect(
      Object.fromEntries(SCHEDULED_JOBS.map((j) => [j.name, j.cron])),
    ).toEqual({
      purgeOldSecurityEvents: CronExpression.EVERY_DAY_AT_4AM,
      purgeStaleUnverifiedAccounts: CronExpression.EVERY_DAY_AT_5AM,
      resetDemoAccount: CronExpression.EVERY_6_HOURS,
    });
  });
});
