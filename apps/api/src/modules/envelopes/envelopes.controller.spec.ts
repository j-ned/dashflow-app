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
import { EnvelopesController } from './envelopes.controller';
import { EnvelopesService } from './envelopes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

// Couvre le DTO de sortie (toEnvelopeResponse) : `userId` ne doit jamais fuiter dans la
// réponse HTTP, et les routes héritées d'OwnedCrudController (list/getOne/create/update)
// doivent rester enregistrées malgré l'override + le re-mapping de la réponse.

const ENV_ROW = {
  id: 'env-1',
  userId: 'u1',
  memberId: null,
  name: 'Vacances',
  type: 'vacances',
  balance: '100.00',
  target: null,
  color: null,
  dueDay: null,
  encryptedData: null,
};

describe('EnvelopesController — DTO de sortie', () => {
  let app: INestApplication;

  const mockSvc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    credit: vi.fn(),
    addTransaction: vi.fn(),
    allTransactions: vi.fn(),
    transactionsOf: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EnvelopesController],
      providers: [{ provide: EnvelopesService, useValue: mockSvc }],
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
    mockSvc.list.mockReset().mockResolvedValue([ENV_ROW]);
    mockSvc.getOne.mockReset().mockResolvedValue(ENV_ROW);
    mockSvc.create.mockReset().mockResolvedValue(ENV_ROW);
    mockSvc.update.mockReset().mockResolvedValue(ENV_ROW);
  });

  it('GET /envelopes → 200, tableau mappé sans userId', async () => {
    const res = await request(app.getHttpServer()).get('/envelopes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'env-1',
        memberId: null,
        name: 'Vacances',
        type: 'vacances',
        balance: '100.00',
        target: null,
        color: null,
        dueDay: null,
        encryptedData: null,
      },
    ]);
  });

  it('GET /envelopes/:id → 200, objet mappé sans userId', async () => {
    const res = await request(app.getHttpServer()).get('/envelopes/env-1');

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeUndefined();
    expect(res.body.id).toBe('env-1');
  });

  it('POST /envelopes → 201, réponse mappée sans userId', async () => {
    const res = await request(app.getHttpServer())
      .post('/envelopes')
      .send({ name: 'Vacances', type: 'vacances' });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBeUndefined();
  });

  it('PUT /envelopes/:id → 200, réponse mappée sans userId', async () => {
    const res = await request(app.getHttpServer())
      .put('/envelopes/env-1')
      .send({ name: 'Vacances 2026', type: 'vacances' });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeUndefined();
  });
});
