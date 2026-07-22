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
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

// Couvre le DTO de sortie (toLoanResponse) : `userId` ne doit jamais fuiter dans la
// réponse HTTP, et les routes héritées d'OwnedCrudController (list/getOne/create/update)
// doivent rester enregistrées malgré l'override + le re-mapping de la réponse.

const LOAN_ROW = {
  id: 'loan-1',
  userId: 'u1',
  memberId: null,
  person: 'Alice',
  direction: 'lent',
  amount: '100.00',
  remaining: '100.00',
  description: null,
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
  encryptedData: null,
};

describe('LoansController — DTO de sortie', () => {
  let app: INestApplication;

  const mockSvc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    recordPayment: vi.fn(),
    addTransaction: vi.fn(),
    allTransactions: vi.fn(),
    transactionsOf: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LoansController],
      providers: [{ provide: LoansService, useValue: mockSvc }],
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
    mockSvc.list.mockReset().mockResolvedValue([LOAN_ROW]);
    mockSvc.getOne.mockReset().mockResolvedValue(LOAN_ROW);
    mockSvc.create.mockReset().mockResolvedValue(LOAN_ROW);
    mockSvc.update.mockReset().mockResolvedValue(LOAN_ROW);
  });

  it('GET /loans → 200, tableau mappé sans userId', async () => {
    const res = await request(app.getHttpServer()).get('/loans');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'loan-1',
        memberId: null,
        person: 'Alice',
        direction: 'lent',
        amount: '100.00',
        remaining: '100.00',
        description: null,
        date: '2026-01-01',
        dueDate: null,
        dueDay: null,
        encryptedData: null,
      },
    ]);
  });

  it('GET /loans/:id → 200, objet mappé sans userId', async () => {
    const res = await request(app.getHttpServer()).get('/loans/loan-1');

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeUndefined();
    expect(res.body.id).toBe('loan-1');
  });

  it('POST /loans → 201, réponse mappée sans userId', async () => {
    const payload = {
      person: 'Alice',
      direction: 'lent',
      amount: 100,
      remaining: 100,
      date: '2026-01-01',
    };
    const res = await request(app.getHttpServer()).post('/loans').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.userId).toBeUndefined();
  });

  it('PUT /loans/:id → 200, réponse mappée sans userId', async () => {
    const payload = {
      person: 'Alice B.',
      direction: 'lent',
      amount: 100,
      remaining: 90,
      date: '2026-01-01',
    };
    const res = await request(app.getHttpServer())
      .put('/loans/loan-1')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeUndefined();
  });
});
