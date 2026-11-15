import { describe, it, expect } from 'vitest';
import { scheduledSlot } from './job-claims';

describe('scheduledSlot', () => {
  it('ramène un tick à la minute planifiée la plus proche', () => {
    expect(scheduledSlot(new Date('2026-11-15T04:00:00.000Z'))).toEqual(
      new Date('2026-11-15T04:00:00.000Z'),
    );
  });

  it("deux instances dont les horloges divergent de part et d'autre de la minute revendiquent le même créneau", () => {
    const early = scheduledSlot(new Date('2026-11-15T03:59:59.950Z'));
    const late = scheduledSlot(new Date('2026-11-15T04:00:00.080Z'));
    expect(early).toEqual(late);
    expect(early).toEqual(new Date('2026-11-15T04:00:00.000Z'));
  });

  it('deux créneaux planifiés successifs restent distincts', () => {
    expect(scheduledSlot(new Date('2026-11-15T04:00:00.000Z'))).not.toEqual(
      scheduledSlot(new Date('2026-11-15T05:00:00.000Z')),
    );
  });
});
