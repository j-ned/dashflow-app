import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DRIZZLE } from '../db/drizzle.constants';

const TOKEN = 'un-jeton-de-sante-assez-long-0123';

async function make(opts: { token?: string; dbFails?: boolean } = {}) {
  const db = {
    execute: opts.dbFails
      ? vi.fn().mockRejectedValue(new Error('down'))
      : vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: DRIZZLE, useValue: db },
      { provide: ConfigService, useValue: { get: () => opts.token } },
    ],
  }).compile();
  return { ctrl: moduleRef.get(HealthController), db };
}

describe('HealthController', () => {
  it('GET /health : sonde de vie sans détail, qui ne touche pas la base', async () => {
    const { ctrl, db } = await make({ dbFails: true });

    expect(ctrl.check()).toEqual({ ok: true });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['aucun jeton configuré', undefined, TOKEN],
    ['jeton absent de la requête', TOKEN, undefined],
    ['mauvais jeton', TOKEN, 'un-autre-jeton-de-la-meme-taille-0'],
    ['jeton de longueur différente', TOKEN, 'court'],
  ])(
    'GET /health/ready, %s → 404 sans interroger la base',
    async (_label, configured, presented) => {
      const { ctrl, db } = await make({ token: configured });

      await expect(ctrl.ready(presented)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.execute).not.toHaveBeenCalled();
    },
  );

  it('GET /health/ready avec le bon jeton : base joignable → ok', async () => {
    const { ctrl } = await make({ token: TOKEN });

    await expect(ctrl.ready(TOKEN)).resolves.toEqual({ ok: true, db: true });
  });

  it('GET /health/ready avec le bon jeton : base en panne → 503', async () => {
    const { ctrl } = await make({ token: TOKEN, dbFails: true });

    await expect(ctrl.ready(TOKEN)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
