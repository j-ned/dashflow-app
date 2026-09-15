import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import {
  MAX_SHARED_ACCESS_PER_USER,
  SharedAccessService,
} from './shared-access.service';
import type { DrizzleDB } from '../../db/drizzle.constants';
import type { Mailer } from '../../mail/mailer';

// Mock Drizzle : `select({ total: count() })` (plafond) et `select({ displayName, email })`
// (expéditeur) partagent la même API fluente ; on aiguille sur la forme de la projection.
function buildDb(opts: {
  total?: number;
  sender?: { displayName: string | null; email: string }[];
}) {
  const returningInsert = vi.fn().mockResolvedValue([
    {
      id: 'row-uuid',
      userId: 'user-1',
      invitedEmail: 'guest@test.com',
      calendarToken: 'a'.repeat(32),
    },
  ]);
  const valuesInsert = vi.fn().mockReturnValue({ returning: returningInsert });
  const insert = vi.fn().mockReturnValue({ values: valuesInsert });

  const select = vi.fn((projection: Record<string, unknown>) => {
    if ('total' in projection) {
      const where = vi.fn().mockResolvedValue([{ total: opts.total ?? 0 }]);
      return { from: vi.fn().mockReturnValue({ where }) };
    }
    const limit = vi
      .fn()
      .mockResolvedValue(
        opts.sender ?? [{ displayName: 'Alice', email: 'alice@test.com' }],
      );
    const where = vi.fn().mockReturnValue({ limit });
    return { from: vi.fn().mockReturnValue({ where }) };
  });

  return { insert, select };
}

describe('SharedAccessService', () => {
  let mockMailer: { sendCalendarInvitation: ReturnType<typeof vi.fn> };

  const make = (db: ReturnType<typeof buildDb>) =>
    new SharedAccessService(
      db as unknown as DrizzleDB,
      mockMailer as unknown as Mailer,
    );

  beforeEach(() => {
    mockMailer = {
      sendCalendarInvitation: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('create', () => {
    it('inserts a row with a 32-char calendarToken', async () => {
      const db = buildDb({});
      const row = await make(db).create('user-1', 'guest@test.com');

      expect(db.insert).toHaveBeenCalled();
      const valuesArg = db.insert.mock.results[0].value.values.mock
        .calls[0][0] as Record<string, string>;
      expect(valuesArg.calendarToken).toHaveLength(32);
      expect(valuesArg.userId).toBe('user-1');
      expect(valuesArg.invitedEmail).toBe('guest@test.com');
      expect(row).toBeDefined();
    });

    it('calls sendCalendarInvitation with correct args', async () => {
      await make(buildDb({})).create('user-1', 'guest@test.com');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMailer.sendCalendarInvitation).toHaveBeenCalledWith(
        'guest@test.com',
        'Alice',
        expect.stringMatching(/^[a-f0-9]{32}$/),
      );
    });

    it('falls back to email when displayName is null', async () => {
      const db = buildDb({
        sender: [{ displayName: null, email: 'alice@test.com' }],
      });
      await make(db).create('user-1', 'guest@test.com');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMailer.sendCalendarInvitation).toHaveBeenCalledWith(
        'guest@test.com',
        'alice@test.com',
        expect.any(String),
      );
    });

    it('falls back to default name when user not found', async () => {
      await make(buildDb({ sender: [] })).create('user-1', 'guest@test.com');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMailer.sendCalendarInvitation).toHaveBeenCalledWith(
        'guest@test.com',
        'Un utilisateur DashFlow',
        expect.any(String),
      );
    });

    it(`given ${MAX_SHARED_ACCESS_PER_USER} partages existants, then 409 sans insert ni e-mail (anti-relais)`, async () => {
      const db = buildDb({ total: MAX_SHARED_ACCESS_PER_USER });

      await expect(
        make(db).create('user-1', 'guest@test.com'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.insert).not.toHaveBeenCalled();
      expect(mockMailer.sendCalendarInvitation).not.toHaveBeenCalled();
    });

    it('given un partage de moins que le plafond, then accepté', async () => {
      const db = buildDb({ total: MAX_SHARED_ACCESS_PER_USER - 1 });
      await expect(
        make(db).create('user-1', 'guest@test.com'),
      ).resolves.toBeDefined();
    });
  });
});
