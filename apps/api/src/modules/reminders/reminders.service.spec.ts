import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemindersService } from './reminders.service';
import type { DrizzleDB } from '../../db/drizzle.constants';
import type { reminders } from '../../db/schema';

type Reminder = typeof reminders.$inferSelect;

describe('RemindersService', () => {
  let svc: RemindersService;

  beforeEach(() => {
    svc = new RemindersService({} as unknown as DrizzleDB);
  });

  describe('toggle', () => {
    it('flips enabled from true to false', async () => {
      const existingRow = { id: 'uuid-1', userId: 'user-1', enabled: true };
      const updatedRow = { ...existingRow, enabled: false };

      vi.spyOn(svc, 'getOne').mockResolvedValue(
        existingRow as unknown as Reminder,
      );
      const updateSpy = vi
        .spyOn(svc, 'update')
        .mockResolvedValue(updatedRow as unknown as Reminder);

      const result = await svc.toggle('user-1', 'uuid-1');

      expect(updateSpy).toHaveBeenCalledWith('user-1', 'uuid-1', {
        enabled: false,
      });
      expect(result).toEqual(updatedRow);
    });

    it('flips enabled from false to true', async () => {
      const existingRow = { id: 'uuid-2', userId: 'user-1', enabled: false };
      const updatedRow = { ...existingRow, enabled: true };

      vi.spyOn(svc, 'getOne').mockResolvedValue(
        existingRow as unknown as Reminder,
      );
      const updateSpy = vi
        .spyOn(svc, 'update')
        .mockResolvedValue(updatedRow as unknown as Reminder);

      const result = await svc.toggle('user-1', 'uuid-2');

      expect(updateSpy).toHaveBeenCalledWith('user-1', 'uuid-2', {
        enabled: true,
      });
      expect(result).toEqual(updatedRow);
    });

    it('returns undefined when reminder not found', async () => {
      vi.spyOn(svc, 'getOne').mockResolvedValue(undefined);

      const result = await svc.toggle('user-1', 'nonexistent-id');

      expect(result).toBeUndefined();
    });
  });
});
