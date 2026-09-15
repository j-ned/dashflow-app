import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import { ConsumablesController } from './consumables.controller';
import { ConsumablesService } from './consumables.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

// PUT /consumables/:id acceptait le body brut (spread dans .set()) : mass assignment et 500 sur
// valeur invalide. Le schéma Zod whitelist maintenant chaque champ.

const ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MEMBER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('ConsumablesController — PUT /consumables/:id (schéma strict)', () => {
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
      controllers: [ConsumablesController],
      providers: [{ provide: ConsumablesService, useValue: mockSvc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'u1', email: 'a@b.com' };
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

  beforeEach(() => {
    mockSvc.update.mockReset().mockResolvedValue({ id: ID, name: 'Encre' });
  });

  it('given champs valides, then seuls ces champs sont transmis (unitPrice en string numeric)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/consumables/${ID}`)
      .send({ quantity: '3', unitPrice: 12.5, memberId: MEMBER });

    expect(res.status).toBe(200);
    expect(mockSvc.update).toHaveBeenCalledWith('u1', ID, {
      quantity: 3,
      unitPrice: '12.5',
      memberId: MEMBER,
    });
  });

  it('given champs inconnus (userId, id, role), then ignorés : pas de mass assignment', async () => {
    const res = await request(app.getHttpServer())
      .put(`/consumables/${ID}`)
      .send({ userId: 'victime', id: 'autre', role: 'admin', name: 'Toner' });

    expect(res.status).toBe(200);
    expect(mockSvc.update).toHaveBeenCalledWith('u1', ID, { name: 'Toner' });
  });

  it.each([
    ['quantity non numérique', { quantity: 'abc' }],
    ['quantity négative', { quantity: -1 }],
    ['catégorie hors enum', { category: 'gold' }],
    ['memberId non uuid', { memberId: 'nope' }],
    ['lastRestocked non ISO', { lastRestocked: 'hier' }],
  ])('given %s, then 400 sans appel service', async (_label, body) => {
    const res = await request(app.getHttpServer())
      .put(`/consumables/${ID}`)
      .send(body);

    expect(res.status).toBe(400);
    expect(mockSvc.update).not.toHaveBeenCalled();
  });

  it('given service ne trouve pas la ligne, then 404', async () => {
    mockSvc.update.mockResolvedValueOnce(undefined);
    const res = await request(app.getHttpServer())
      .put(`/consumables/${ID}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});
