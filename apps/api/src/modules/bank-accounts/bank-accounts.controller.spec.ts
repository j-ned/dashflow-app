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
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

// Couvre le DTO de sortie (toBankAccountResponse) : `userId` ne doit jamais fuiter dans
// la réponse HTTP des routes list/create/update.

const ACCOUNT_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: 'u1',
  name: 'Compte courant',
  type: 'courant',
  initialBalance: '0',
  color: null,
  dotColor: null,
  encryptedData: null,
  createdAt: new Date('2026-01-01'),
};

describe('BankAccountsController — DTO de sortie', () => {
  let app: INestApplication;

  const mockSvc = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BankAccountsController],
      providers: [{ provide: BankAccountsService, useValue: mockSvc }],
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
    mockSvc.list
      .mockReset()
      .mockResolvedValue({ items: [ACCOUNT_ROW], nextCursor: null });
    mockSvc.create.mockReset().mockResolvedValue(ACCOUNT_ROW);
    mockSvc.update.mockReset().mockResolvedValue(ACCOUNT_ROW);
  });

  it('GET /bank-accounts → 200, tableau mappé sans userId', async () => {
    const res = await request(app.getHttpServer()).get('/bank-accounts');

    expect(res.status).toBe(200);
    expect(res.body[0].userId).toBeUndefined();
    expect(res.body[0].id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('POST /bank-accounts → 201, réponse mappée sans userId', async () => {
    const res = await request(app.getHttpServer())
      .post('/bank-accounts')
      .send({ name: 'Compte courant' });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBeUndefined();
  });

  it('PUT /bank-accounts/:id → 200, réponse mappée sans userId', async () => {
    const res = await request(app.getHttpServer())
      .put('/bank-accounts/11111111-1111-4111-8111-111111111111')
      .send({ name: 'Compte courant 2' });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeUndefined();
  });
});
