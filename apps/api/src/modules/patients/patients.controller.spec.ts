import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { FeatureGuard } from '../entitlements/feature.guard';

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
      .overrideGuard(FeatureGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /patients → 200 et appelle svc.list(userId)', async () => {
    const rows = [{ id: 'p1', firstName: 'A' }];
    mockSvc.list.mockResolvedValueOnce(rows);

    const res = await request(app.getHttpServer()).get('/patients');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(mockSvc.list).toHaveBeenCalledWith('u1');
  });

  it('GET /patients/:id → 200 quand getOne renvoie un objet', async () => {
    const row = { id: 'p1', firstName: 'A' };
    mockSvc.getOne.mockResolvedValueOnce(row);

    const res = await request(app.getHttpServer()).get('/patients/p1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(row);
    expect(mockSvc.getOne).toHaveBeenCalledWith('u1', 'p1');
  });

  it('GET /patients/:id → 404 quand getOne renvoie undefined', async () => {
    mockSvc.getOne.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer()).get('/patients/x');

    expect(res.status).toBe(404);
  });

  it('POST /patients → 201 et invoque le hook toCreateValues', async () => {
    mockSvc.create.mockResolvedValueOnce({ id: 'p9' });

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
    mockSvc.update.mockResolvedValueOnce({ id: 'p1', notes: 'x' });

    const res = await request(app.getHttpServer())
      .put('/patients/p1')
      .send({ notes: 'x' });

    expect(res.status).toBe(200);
    expect(mockSvc.update).toHaveBeenCalledWith('u1', 'p1', expect.objectContaining({ notes: 'x' }));
  });

  it('DELETE /patients/:id → 204', async () => {
    mockSvc.remove.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer()).delete('/patients/p1');

    expect(res.status).toBe(204);
    expect(mockSvc.remove).toHaveBeenCalledWith('u1', 'p1');
  });
});
