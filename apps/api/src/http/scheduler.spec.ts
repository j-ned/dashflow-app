import { describe, it, expect } from 'vitest';
import { SCHEDULED_JOBS } from './scheduler';

describe('Tâches planifiées Hono', () => {
  it('horaires des tâches de fond (inchangés depuis @nestjs/schedule)', () => {
    expect(
      Object.fromEntries(SCHEDULED_JOBS.map((j) => [j.name, j.cron])),
    ).toEqual({
      purgeOldSecurityEvents: '0 04 * * *',
      purgeStaleUnverifiedAccounts: '0 05 * * *',
      resetDemoAccount: '0 0-23/6 * * *',
    });
  });
});
