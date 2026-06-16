import { describe, it, expect } from 'vitest';
import { MembersService } from './members.service';
import type { DrizzleDB } from '../../db/drizzle.constants';

// Faux DrizzleDB : `insert().values().returning()` renvoie la ligne projetée (MEMBER_PROJECTION).
function dbReturning(insertedRow: Record<string, unknown> = { id: 'new' }): DrizzleDB {
  return {
    insert: () => ({ values: () => ({ returning: async () => [insertedRow] }) }),
  } as unknown as DrizzleDB;
}

describe('MembersService.create', () => {
  it('insère le membre et renvoie la ligne projetée', async () => {
    const svc = new MembersService(dbReturning({ id: 'new', firstName: 'A' }));
    const row = await svc.create('u1', { firstName: 'A' });
    expect(row).toEqual({ id: 'new', firstName: 'A' });
  });
});
