import { describe, it, expect, vi } from 'vitest';
import { OwnedCrudService } from './owned-crud.service';

function fakeDb(rows: any[]) {
  const chain: any = {
    _rows: rows,
    select: vi.fn(() => chain), from: vi.fn(() => chain), where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(chain._rows)),
    insert: vi.fn(() => chain), values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(chain._rows)),
    update: vi.fn(() => chain), set: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  };
  return chain;
}
const table = { id: 'idcol', userId: 'usercol' } as any;

describe('OwnedCrudService', () => {
  it('getOne renvoie undefined si non possédé', async () => {
    const svc = new OwnedCrudService(fakeDb([]) as any, table);
    expect(await svc.getOne('u1', 'x')).toBeUndefined();
  });
  it('create injecte userId', async () => {
    const db = fakeDb([{ id: 'r1' }]);
    const svc = new OwnedCrudService(db as any, table);
    const row = await svc.create('u1', { name: 'A' });
    expect(db.values).toHaveBeenCalledWith({ name: 'A', userId: 'u1' });
    expect(row).toEqual({ id: 'r1' });
  });
});
