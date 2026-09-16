import { describe, it, expect, vi } from 'vitest';
import { MedicationsService } from './medications.service';

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
  startDate: '2020-01-01',
  alertDaysBefore: 7,
  skipDays: [],
  encryptedData: null,
  createdAt: new Date(),
  ...overrides,
});

function makeService(rows: unknown[] = [], returning: unknown[] = []) {
  const fakeDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  };
  return { svc: new MedicationsService(fakeDb as never), fakeDb };
}

describe('MedicationsService.alerts', () => {
  it('applique le modèle de stock commun : startDate lointain + petit stock → à sec → alerte', async () => {
    // 14 comprimés depuis 2020 à 2/jour : tout est consommé, rupture aujourd'hui.
    const { svc } = makeService([makeMed()]);
    const res = await svc.alerts('user-1');
    expect(res).toHaveLength(1);
    expect(res[0].remainingQuantity).toBe(0);
    expect(res[0].isLow).toBe(true);
  });

  it('stock large et récent : pas d’alerte', async () => {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    const { svc } = makeService([
      makeMed({
        quantity: 200,
        dailyRate: '1',
        startDate: start.toISOString().slice(0, 10),
      }),
    ]);
    expect(await svc.alerts('user-1')).toHaveLength(0);
  });

  it('rythme nul : jamais en alerte', async () => {
    const { svc } = makeService([makeMed({ dailyRate: '0', quantity: 0 })]);
    expect(await svc.alerts('user-1')).toHaveLength(0);
  });
});

describe('MedicationsService.refill', () => {
  it('incrémente en une requête UPDATE scopée (user_id) et renvoie la ligne', async () => {
    const updated = makeMed({ quantity: 24 });
    const { svc, fakeDb } = makeService([], [updated]);
    const res = await svc.refill('user-1', 'med-1', 10);
    expect(fakeDb.update).toHaveBeenCalled();
    expect(fakeDb.set).toHaveBeenCalledTimes(1);
    expect(fakeDb.where).toHaveBeenCalledTimes(1);
    expect(res).toEqual(updated);
  });

  it('médicament inconnu ou d’un autre utilisateur : undefined (le controller fait le 404)', async () => {
    const { svc } = makeService([], []);
    expect(await svc.refill('user-1', 'autre', 10)).toBeUndefined();
  });
});
