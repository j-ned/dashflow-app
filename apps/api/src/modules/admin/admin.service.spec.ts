import { describe, it, expect, vi } from 'vitest';
import { AdminService } from './admin.service';
import type { AdminRepository, AdminUserRow } from './admin.repository';

function row(over: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: 'u1',
    email: 'a@b.com',
    role: 'user',
    isDemoAccount: false,
    createdAt: new Date('2026-01-01'),
    ...over,
  };
}

const repo = (rows: AdminUserRow[], total = rows.length): AdminRepository =>
  ({
    listUsers: vi.fn().mockResolvedValue(rows),
    countAll: vi.fn().mockResolvedValue(total),
  }) as unknown as AdminRepository;

describe('AdminService.listUsers', () => {
  it('mappe chaque ligne vers une vue membre (sans notion de billing)', async () => {
    const svc = new AdminService(repo([row()]));
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.items[0]).toEqual({
      id: 'u1',
      email: 'a@b.com',
      role: 'user',
      isDemoAccount: false,
      createdAt: new Date('2026-01-01'),
    });
  });

  it('préserve le rôle admin', async () => {
    const svc = new AdminService(repo([row({ role: 'admin' })]));
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.items[0].role).toBe('admin');
  });

  it('normalise un rôle inconnu vers "user"', async () => {
    const svc = new AdminService(repo([row({ role: 'whatever' })]));
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.items[0].role).toBe('user');
  });

  it('retourne le total fourni par le repository (indépendant de la page)', async () => {
    const svc = new AdminService(repo([row()], 57));
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.total).toBe(57);
  });

  it('transmet search/limit/offset au repository', async () => {
    const r = repo([row()], 1);
    const svc = new AdminService(r);
    await svc.listUsers({ search: 'a@b', limit: 10, offset: 20 });
    expect(r.listUsers).toHaveBeenCalledWith({
      search: 'a@b',
      limit: 10,
      offset: 20,
    });
    expect(r.countAll).toHaveBeenCalledWith('a@b');
  });
});
