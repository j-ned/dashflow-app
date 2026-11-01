import { describe, it, expect, vi } from 'vitest';
import { honoTestApp, TEST_ENV } from '../../../test/support/hono-test-app';
import type { SecurityEventsService } from '../../security-events/security-events.service';
import type { AdminService } from '../../modules/admin/admin.service';
import type { DemoService } from '../../modules/demo/demo.service';
import type { Env } from '../../config/env.schema';

const SECRET = 'c'.repeat(32);

async function app(env: Partial<Env> = { CRON_SECRET: SECRET }) {
  const purgeOld = vi.fn().mockResolvedValue(undefined);
  const purgeStaleUnverified = vi.fn().mockResolvedValue(undefined);
  const scheduledReset = vi.fn().mockResolvedValue(undefined);
  const t = await honoTestApp({
    env: { ...TEST_ENV, ...env },
    securityEvents: { purgeOld } as unknown as SecurityEventsService,
    admin: { purgeStaleUnverified } as unknown as AdminService,
    demo: { scheduledReset } as unknown as DemoService,
  });
  return { ...t, purgeOld, purgeStaleUnverified, scheduledReset };
}

const bearer = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

describe('Routes /cron (Vercel Cron)', () => {
  it('bon jeton → 200 et la tâche correspondante tourne, elle seule', async () => {
    const t = await app();
    const res = await t.anonymous(
      '/cron/purge-security-events',
      bearer(SECRET),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      job: 'purge-security-events',
    });
    expect(t.purgeOld).toHaveBeenCalledTimes(1);
    expect(t.purgeStaleUnverified).not.toHaveBeenCalled();
    expect((await t.anonymous('/cron/reset-demo', bearer(SECRET))).status).toBe(
      200,
    );
    expect(t.scheduledReset).toHaveBeenCalledTimes(1);
  });

  it('404 sans jeton, avec un mauvais jeton ou une tâche inconnue — rien ne tourne', async () => {
    const t = await app();
    expect((await t.anonymous('/cron/purge-security-events')).status).toBe(404);
    expect(
      (await t.anonymous('/cron/purge-security-events', bearer('x'.repeat(32))))
        .status,
    ).toBe(404);
    expect((await t.anonymous('/cron/inconnue', bearer(SECRET))).status).toBe(
      404,
    );
    expect(t.purgeOld).not.toHaveBeenCalled();
  });

  it('404 quand CRON_SECRET n’est pas configuré, même avec « Bearer undefined »', async () => {
    const t = await app({ CRON_SECRET: undefined });
    expect(
      (await t.anonymous('/cron/purge-security-events', bearer('undefined')))
        .status,
    ).toBe(404);
    expect(t.purgeOld).not.toHaveBeenCalled();
  });
});
