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
import { SalaryArchivesController } from './salary-archives.controller';
import { SalaryArchivesService } from './salary-archives.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

// Le front poste TOUJOURS l'archive en multipart/form-data (postForm). Le create
// hérité d'OwnedCrudController n'a pas d'interceptor multer → le body multipart
// n'est pas parsé → 500. Ces tests décrivent le comportement attendu (201 + parsing).
// RED attendu tant que create n'est pas surchargé avec FileInterceptor('payslip').

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

describe('SalaryArchivesController — POST /salary-archives (multipart)', () => {
  let app: INestApplication;

  const mockSvc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const mockStorage = {
    payslipKey: vi.fn(() => 'payslips/u1/arch-1.pdf'),
    upload: vi.fn(),
    getStream: vi.fn(),
    delete: vi.fn(),
    deletePrefix: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SalaryArchivesController],
      providers: [
        { provide: SalaryArchivesService, useValue: mockSvc },
        { provide: StorageService, useValue: mockStorage },
      ],
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
    mockSvc.create.mockReset().mockResolvedValue({ id: 'arch-1' });
    mockSvc.update.mockReset().mockResolvedValue({
      id: 'arch-1',
      payslipKey: 'payslips/u1/arch-1.pdf',
    });
    mockStorage.payslipKey.mockClear();
    mockStorage.upload.mockReset().mockResolvedValue(undefined);
  });

  it('mode clair (sans fichier) → 201 et svc.create reçoit month + spendings en ARRAY', async () => {
    const spendings = [
      { label: 'x', amount: 50, date: '2026-06-10', category: 'c' },
    ];

    const res = await request(app.getHttpServer())
      .post('/salary-archives')
      .field('month', '2026-06')
      .field('salary', '1500')
      .field('totalExpenses', '200')
      .field('totalSpendings', '50')
      .field('spendings', JSON.stringify(spendings));

    expect(res.status).toBe(201);
    expect(mockSvc.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        month: '2026-06',
        salary: '1500',
        spendings,
      }),
    );
    const passed = mockSvc.create.mock.calls[0]?.[1] as { spendings: unknown };
    expect(Array.isArray(passed.spendings)).toBe(true);
  });

  it('mode chiffré (encryptedData) → 201 et svc.create reçoit month/salary placeholders', async () => {
    const res = await request(app.getHttpServer())
      .post('/salary-archives')
      .field('encryptedData', 'blob123')
      .field('accountId', ACCOUNT_ID);

    expect(res.status).toBe(201);
    expect(mockSvc.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        encryptedData: 'blob123',
        month: '0000-00',
        salary: '0',
      }),
    );
  });

  it('payslip optionnel → storage.upload appelé, svc.update reçoit { payslipKey }, 201', async () => {
    const spendings = [
      { label: 'x', amount: 50, date: '2026-06-10', category: 'c' },
    ];

    const res = await request(app.getHttpServer())
      .post('/salary-archives')
      .field('month', '2026-06')
      .field('salary', '1500')
      .field('totalExpenses', '200')
      .field('totalSpendings', '50')
      .field('spendings', JSON.stringify(spendings))
      .attach('payslip', Buffer.from('%PDF-1.4'), 'p.pdf');

    expect(res.status).toBe(201);
    expect(mockSvc.create).toHaveBeenCalledTimes(1);
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    expect(mockSvc.update).toHaveBeenCalledWith(
      'u1',
      'arch-1',
      expect.objectContaining({ payslipKey: expect.any(String) }),
    );
  });
});

// Non-régression : la garde CSRF doit rester active sur le create surchargé.
describe('SalaryArchivesController — POST /salary-archives garde CSRF active', () => {
  let app: INestApplication;

  const mockSvc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const mockStorage = {
    payslipKey: vi.fn(),
    upload: vi.fn(),
    getStream: vi.fn(),
    delete: vi.fn(),
    deletePrefix: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SalaryArchivesController],
      providers: [
        { provide: SalaryArchivesService, useValue: mockSvc },
        { provide: StorageService, useValue: mockStorage },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'u1' };
          return true;
        },
      })
      .overrideGuard(CsrfGuard)
      .useValue({ canActivate: () => false })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('CsrfGuard refuse → 403, svc.create jamais appelé', async () => {
    const res = await request(app.getHttpServer())
      .post('/salary-archives')
      .field('month', '2026-06')
      .field('salary', '1500');

    expect(res.status).toBe(403);
    expect(mockSvc.create).not.toHaveBeenCalled();
  });
});
