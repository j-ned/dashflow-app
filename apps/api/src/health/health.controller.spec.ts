import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DRIZZLE } from '../db/drizzle.constants';

describe('HealthController', () => {
  it('retourne ok=true et db=true quand le ping réussit', async () => {
    const db = { execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DRIZZLE, useValue: db }],
    }).compile();
    const res = await moduleRef.get(HealthController).check();
    expect(res.ok).toBe(true);
    expect(res.db).toBe(true);
    expect(db.execute).toHaveBeenCalled();
  });

  it('retourne db=false quand le ping échoue', async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error('down')) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DRIZZLE, useValue: db }],
    }).compile();
    const res = await moduleRef.get(HealthController).check();
    expect(res.ok).toBe(true);
    expect(res.db).toBe(false);
  });
});
