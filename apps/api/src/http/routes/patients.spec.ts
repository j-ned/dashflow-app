import { describe, it, expect, vi } from 'vitest';
import {
  honoTestApp,
  jsonInit,
  TEST_USER,
} from '../../../test/support/hono-test-app';
import type { PatientsService } from '../../modules/patients/patients.service';

const ID = '22222222-2222-4222-8222-222222222222';

function patientsMock() {
  return {
    list: vi
      .fn()
      .mockResolvedValue({ items: [{ id: ID }], nextCursor: undefined }),
    getOne: vi.fn().mockResolvedValue({ id: ID }),
    create: vi
      .fn()
      .mockImplementation((_u: string, v: object) =>
        Promise.resolve({ id: ID, ...v }),
      ),
    update: vi.fn().mockResolvedValue({ id: ID }),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Routes /patients (Hono)', () => {
  it('GET / → 200 et svc.list(userId) ; X-Next-Cursor exposé quand une page suit', async () => {
    const svc = patientsMock();
    svc.list.mockResolvedValue({ items: [{ id: ID }], nextCursor: 'abc' });
    const t = await honoTestApp({
      patients: svc as unknown as PatientsService,
    });
    const res = await t.authed('/patients');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: ID }]);
    expect(res.headers.get('X-Next-Cursor')).toBe('abc');
    expect(svc.list).toHaveBeenCalledWith(TEST_USER.id, expect.any(Object));
  });

  it('GET /:id → 200, 404 si absent, 400 non-UUID sans toucher au service', async () => {
    const svc = patientsMock();
    const t = await honoTestApp({
      patients: svc as unknown as PatientsService,
    });
    expect((await t.authed(`/patients/${ID}`)).status).toBe(200);
    svc.getOne.mockResolvedValueOnce(undefined);
    expect((await t.authed(`/patients/${ID}`)).status).toBe(404);
    svc.getOne.mockClear();
    expect((await t.authed('/patients/abc')).status).toBe(400);
    expect(svc.getOne).not.toHaveBeenCalled();
  });

  it('GET /?limit=abc → 400 (pagination invalide)', async () => {
    const t = await honoTestApp({
      patients: patientsMock() as unknown as PatientsService,
    });
    expect((await t.authed('/patients?limit=abc')).status).toBe(400);
  });

  it('POST / → 201 via toCreateValues ; PUT /:id → 200 ; DELETE /:id → 204', async () => {
    const svc = patientsMock();
    const t = await honoTestApp({
      patients: svc as unknown as PatientsService,
    });
    const created = await t.authed(
      '/patients',
      jsonInit('POST', {
        firstName: 'Léa',
        lastName: 'Test',
        birthDate: '2017-11-04',
      }),
    );
    expect(created.status).toBe(201);
    expect(svc.create).toHaveBeenCalledWith(
      TEST_USER.id,
      expect.objectContaining({ firstName: 'Léa', color: null, notes: null }),
    );
    expect(
      (await t.authed(`/patients/${ID}`, jsonInit('PUT', { firstName: 'Zoé' })))
        .status,
    ).toBe(200);
    expect(
      (await t.authed(`/patients/${ID}`, { method: 'DELETE' })).status,
    ).toBe(204);
  });

  it('401 sans session ; 403 sur mutation sans jeton CSRF', async () => {
    const svc = patientsMock();
    const t = await honoTestApp({
      patients: svc as unknown as PatientsService,
    });
    expect((await t.anonymous('/patients')).status).toBe(401);
    const res = await t.authed('/patients', {
      ...jsonInit('POST', {
        firstName: 'A',
        lastName: 'B',
        birthDate: '2000-01-01',
      }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'faux' },
    });
    expect(res.status).toBe(403);
    expect(svc.create).not.toHaveBeenCalled();
  });
});
