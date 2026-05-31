import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedicationsService } from './medications.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMed = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'med-1',
  userId: 'user-1',
  prescriptionId: null,
  patientId: 'patient-1',
  name: 'Paracetamol',
  type: 'comprime' as const,
  dosage: '500mg',
  quantity: 14,
  dailyRate: '2',
  startDate: '2026-01-01',
  alertDaysBefore: 7,
  skipDays: [],
  encryptedData: null,
  createdAt: new Date(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Factory — builds a MedicationsService with an injectable fake DB
// ---------------------------------------------------------------------------

function makeService(dbOverride?: Partial<Record<string, unknown>>) {
  const fakeDb: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    ...dbOverride,
  };

  // MedicationsService extends OwnedCrudService which takes (db, table)
  // We inject DRIZZLE via constructor — but since it's @Inject(DRIZZLE),
  // we instantiate directly for unit tests.
  const svc = new MedicationsService(fakeDb as never);
  return { svc, fakeDb };
}

// ---------------------------------------------------------------------------
// Tests: alerts threshold computation (in-memory logic)
// ---------------------------------------------------------------------------

describe('MedicationsService.alerts', () => {
  it('returns medications where daysRemaining <= alertDaysBefore', async () => {
    const { svc, fakeDb } = makeService();

    // Med A: quantity=14, dailyRate=2, skipDays=[], alertDaysBefore=7
    //   weeklyRate = 2 * 7 = 14 pills/week → daysRemaining = (14/14)*7 = 7 → 7 <= 7 ✓ included
    const medA = makeMed({ quantity: 14, dailyRate: '2', skipDays: [], alertDaysBefore: 7 });

    // Med B: quantity=100, dailyRate=1, skipDays=[], alertDaysBefore=7
    //   weeklyRate = 7 → daysRemaining = (100/7)*7 = 100 → 100 > 7 ✗ excluded
    const medB = makeMed({ id: 'med-2', quantity: 100, dailyRate: '1', skipDays: [], alertDaysBefore: 7 });

    // Med C: quantity=5, dailyRate=2, skipDays=[6], alertDaysBefore=3
    //   activeDays = 7-1=6, weeklyRate=2*6=12 → daysRemaining = (5/12)*7 ≈ 2.92 → 2.92 <= 3 ✓ included
    const medC = makeMed({ id: 'med-3', quantity: 5, dailyRate: '2', skipDays: [6], alertDaysBefore: 3 });

    (fakeDb.limit as ReturnType<typeof vi.fn>).mockResolvedValue([medA, medB, medC]);

    const result = await svc.alerts('user-1');

    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toContain('med-1');
    expect(result.map((m) => m.id)).toContain('med-3');
    expect(result.map((m) => m.id)).not.toContain('med-2');
  });

  it('computes daysRemaining rounded to 2 decimal places', async () => {
    const { svc, fakeDb } = makeService();

    // quantity=5, dailyRate=2, skipDays=[6] → (5/12)*7 = 2.9166... → rounds to 2.92
    const med = makeMed({ quantity: 5, dailyRate: '2', skipDays: [6], alertDaysBefore: 5 });
    (fakeDb.limit as ReturnType<typeof vi.fn>).mockResolvedValue([med]);

    const [result] = await svc.alerts('user-1');
    expect(result.daysRemaining).toBe(2.92);
  });

  it('treats weeklyRate=0 as Infinity (never alert)', async () => {
    const { svc, fakeDb } = makeService();

    // dailyRate=0 → weeklyRate=0 → daysRemaining=Infinity → never <= alertDaysBefore
    const med = makeMed({ quantity: 0, dailyRate: '0', skipDays: [], alertDaysBefore: 999 });
    (fakeDb.limit as ReturnType<typeof vi.fn>).mockResolvedValue([med]);

    const result = await svc.alerts('user-1');
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: refill (calls update with increased quantity)
// ---------------------------------------------------------------------------

describe('MedicationsService.refill', () => {
  it('adds refill quantity to the existing quantity and calls update', async () => {
    const currentQuantity = 10;
    const refillQuantity = 30;

    const updatedMed = makeMed({ quantity: currentQuantity + refillQuantity });

    // Chain for the initial SELECT (fetches current quantity)
    const selectLimit = vi.fn().mockResolvedValue([{ quantity: currentQuantity }]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

    // Chain for the UPDATE (called by this.update internally)
    const returningFn = vi.fn().mockResolvedValue([updatedMed]);
    const updateWhere = vi.fn().mockReturnValue({ returning: returningFn });
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const updateFn = vi.fn().mockReturnValue({ set: updateSet });

    const fakeDb = {
      select: selectFn,
      update: updateFn,
    };

    const svc = new MedicationsService(fakeDb as never);
    const result = await svc.refill('user-1', 'med-1', refillQuantity);

    // Assert the update was called with the summed quantity
    expect(updateSet).toHaveBeenCalledWith({ quantity: currentQuantity + refillQuantity });
    expect(result).toEqual(updatedMed);
  });

  it('returns undefined when medication not found (no 404 thrown here)', async () => {
    const selectLimit = vi.fn().mockResolvedValue([]); // empty = not found
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

    const fakeDb = { select: selectFn };
    const svc = new MedicationsService(fakeDb as never);

    const result = await svc.refill('user-1', 'nonexistent', 10);
    expect(result).toBeUndefined();
  });
});
