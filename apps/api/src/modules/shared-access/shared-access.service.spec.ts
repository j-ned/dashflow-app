import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharedAccessService } from './shared-access.service';
import type { DrizzleDB } from '../../db/drizzle.constants';
import type { Mailer } from '../../mail/mailer';

describe('SharedAccessService', () => {
  let svc: SharedAccessService;
  let mockDb;
  let mockMailer;

  beforeEach(() => {
    mockMailer = {
      sendCalendarInvitation: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Drizzle fluent chain for insert + select
    const returningInsert = vi.fn().mockResolvedValue([
      {
        id: 'row-uuid',
        userId: 'user-1',
        invitedEmail: 'guest@test.com',
        calendarToken: 'a'.repeat(32),
      },
    ]);
    const valuesInsert = vi
      .fn()
      .mockReturnValue({ returning: returningInsert });
    const insertFn = vi.fn().mockReturnValue({ values: valuesInsert });

    const limitSelect = vi
      .fn()
      .mockResolvedValue([{ displayName: 'Alice', email: 'alice@test.com' }]);
    const whereSelect = vi.fn().mockReturnValue({ limit: limitSelect });
    const fromSelect = vi.fn().mockReturnValue({ where: whereSelect });
    const selectFn = vi.fn().mockReturnValue({ from: fromSelect });

    mockDb = {
      insert: insertFn,
      select: selectFn,
    };

    svc = new SharedAccessService(
      mockDb as unknown as DrizzleDB,
      mockMailer as unknown as Mailer,
    );
  });

  describe('create', () => {
    it('inserts a row with a 32-char calendarToken', async () => {
      const row = await svc.create('user-1', 'guest@test.com');

      expect(mockDb.insert).toHaveBeenCalled();
      const valuesArg = mockDb.insert().values.mock.calls[0][0];
      expect(valuesArg.calendarToken).toHaveLength(32);
      expect(valuesArg.userId).toBe('user-1');
      expect(valuesArg.invitedEmail).toBe('guest@test.com');
      expect(row).toBeDefined();
    });

    it('calls sendCalendarInvitation with correct args', async () => {
      await svc.create('user-1', 'guest@test.com');

      // Wait for the void fire-and-forget to settle
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMailer.sendCalendarInvitation).toHaveBeenCalledWith(
        'guest@test.com',
        'Alice',
        expect.stringMatching(/^[a-f0-9]{32}$/),
      );
    });

    it('falls back to email when displayName is null', async () => {
      // Override select chain to return user with no displayName
      const limitSelect = vi
        .fn()
        .mockResolvedValue([{ displayName: null, email: 'alice@test.com' }]);
      const whereSelect = vi.fn().mockReturnValue({ limit: limitSelect });
      const fromSelect = vi.fn().mockReturnValue({ where: whereSelect });
      mockDb.select = vi.fn().mockReturnValue({ from: fromSelect });

      await svc.create('user-1', 'guest@test.com');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMailer.sendCalendarInvitation).toHaveBeenCalledWith(
        'guest@test.com',
        'alice@test.com',
        expect.any(String),
      );
    });

    it('falls back to default name when user not found', async () => {
      const limitSelect = vi.fn().mockResolvedValue([]);
      const whereSelect = vi.fn().mockReturnValue({ limit: limitSelect });
      const fromSelect = vi.fn().mockReturnValue({ where: whereSelect });
      mockDb.select = vi.fn().mockReturnValue({ from: fromSelect });

      await svc.create('user-1', 'guest@test.com');
      await new Promise((r) => setTimeout(r, 10));

      expect(mockMailer.sendCalendarInvitation).toHaveBeenCalledWith(
        'guest@test.com',
        'Un utilisateur DashFlow',
        expect.any(String),
      );
    });
  });
});
