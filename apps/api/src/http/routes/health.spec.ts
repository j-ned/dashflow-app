import { describe, it, expect, vi } from 'vitest';
import { honoTestApp, TEST_ENV } from '../../../test/support/hono-test-app';
import type { DrizzleDB } from '../../db/drizzle.constants';

const TOKEN = 'un-jeton-de-sante-assez-long-0123';

async function make(opts: { token?: string; dbFails?: boolean } = {}) {
  const execute = opts.dbFails
    ? vi.fn().mockRejectedValue(new Error('down'))
    : vi.fn().mockResolvedValue([{ '?column?': 1 }]);
  const t = await honoTestApp({
    db: { execute } as unknown as DrizzleDB,
    env: { ...TEST_ENV, HEALTH_TOKEN: opts.token },
  });
  const ready = (presented?: string) =>
    t.anonymous(
      '/health/ready',
      presented ? { headers: { 'X-Health-Token': presented } } : undefined,
    );
  return { t, execute, ready };
}

describe('Routes /health (Hono)', () => {
  it('GET /health : sonde de vie sans détail, qui ne touche pas la base', async () => {
    const { t, execute } = await make({ dbFails: true });
    const res = await t.anonymous('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['aucun jeton configuré', undefined, TOKEN],
    ['jeton absent de la requête', TOKEN, undefined],
    ['mauvais jeton', TOKEN, 'un-autre-jeton-de-la-meme-taille-0'],
    ['jeton de longueur différente', TOKEN, 'court'],
  ])(
    'GET /health/ready, %s → 404 sans interroger la base',
    async (_label, configured, presented) => {
      const { execute, ready } = await make({ token: configured });
      expect((await ready(presented)).status).toBe(404);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('GET /health/ready avec le bon jeton : base joignable → ok', async () => {
    const { ready } = await make({ token: TOKEN });
    const res = await ready(TOKEN);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  it('GET /health/ready avec le bon jeton : base en panne → 503', async () => {
    const { ready } = await make({ token: TOKEN, dbFails: true });
    expect((await ready(TOKEN)).status).toBe(503);
  });
});
