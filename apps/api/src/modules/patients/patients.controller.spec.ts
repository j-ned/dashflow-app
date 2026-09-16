import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

describe('PatientsController (routes héritées de OwnedCrudController)', () => {
  let app: INestApplication;
  const mockSvc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [{ provide: PatientsService, useValue: mockSvc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'u1' };
          return true;
        },
      })
      .overrideGuard(CsrfGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /patients → 200 et appelle svc.list(userId)', async () => {
    const rows = [
      { id: '11111111-1111-4111-8111-111111111111', firstName: 'A' },
    ];
    mockSvc.list.mockResolvedValueOnce({ items: rows, nextCursor: null });

    const res = await request(app.getHttpServer()).get('/patients');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(mockSvc.list).toHaveBeenCalledWith('u1', {});
  });

  it('GET /patients/:id → 200 quand getOne renvoie un objet', async () => {
    const row = { id: '11111111-1111-4111-8111-111111111111', firstName: 'A' };
    mockSvc.getOne.mockResolvedValueOnce(row);

    const res = await request(app.getHttpServer()).get(
      '/patients/11111111-1111-4111-8111-111111111111',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(row);
    expect(mockSvc.getOne).toHaveBeenCalledWith(
      'u1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('GET /patients/:id → 404 quand getOne renvoie undefined', async () => {
    mockSvc.getOne.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer()).get(
      '/patients/22222222-2222-4222-8222-222222222222',
    );

    expect(res.status).toBe(404);
  });

  it('POST /patients → 201 et invoque le hook toCreateValues', async () => {
    mockSvc.create.mockResolvedValueOnce({
      id: '22222222-2222-4222-8222-222222222222',
    });

    const res = await request(app.getHttpServer())
      .post('/patients')
      .send({ firstName: 'A', lastName: 'B', birthDate: '1970-01-01' });

    expect(res.status).toBe(201);
    expect(mockSvc.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ firstName: 'A', lastName: 'B' }),
    );
  });

  it('PUT /patients/:id → 200 quand update renvoie un objet', async () => {
    mockSvc.update.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      notes: 'x',
    });

    const res = await request(app.getHttpServer())
      .put('/patients/11111111-1111-4111-8111-111111111111')
      .send({ notes: 'x' });

    expect(res.status).toBe(200);
    expect(mockSvc.update).toHaveBeenCalledWith(
      'u1',
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ notes: 'x' }),
    );
  });

  it('DELETE /patients/:id → 204', async () => {
    mockSvc.remove.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer()).delete(
      '/patients/11111111-1111-4111-8111-111111111111',
    );

    expect(res.status).toBe(204);
    expect(mockSvc.remove).toHaveBeenCalledWith(
      'u1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('GET /patients → X-Next-Cursor exposé quand une page suit, tableau inchangé', async () => {
    mockSvc.list.mockResolvedValueOnce({
      items: [{ id: '11111111-1111-4111-8111-111111111111' }],
      nextCursor: 'curseur-opaque',
    });
    const res = await request(app.getHttpServer()).get('/patients?limit=1');
    expect(res.status).toBe(200);
    expect(res.headers['x-next-cursor']).toBe('curseur-opaque');
    expect(res.body).toEqual([{ id: '11111111-1111-4111-8111-111111111111' }]);
    expect(mockSvc.list).toHaveBeenCalledWith('u1', { limit: 1 });
  });

  it('GET /patients?limit=abc → 400 (pagination invalide)', async () => {
    mockSvc.list.mockClear();
    const res = await request(app.getHttpServer()).get('/patients?limit=abc');
    expect(res.status).toBe(400);
    expect(mockSvc.list).not.toHaveBeenCalled();
  });

  it('GET /patients/:id non-UUID → 400 sans toucher au service (plus de 500 drizzle)', async () => {
    mockSvc.getOne.mockClear();
    const res = await request(app.getHttpServer()).get('/patients/abc');
    expect(res.status).toBe(400);
    expect(mockSvc.getOne).not.toHaveBeenCalled();
  });
});
