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
import { RecurringEntriesController } from './recurring-entries.controller';
import { RecurringEntriesService } from './recurring-entries.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

// Expose les transformations protégées (pures) pour les tester sans HTTP ni DB.
class TestableController extends RecurringEntriesController {
  publicCreateValues(body: Record<string, unknown>) {
    return this.toCreateValues(body);
  }
  publicUpdatePatch(body: Record<string, unknown>) {
    return this.toUpdatePatch(body);
  }
}

describe('RecurringEntriesController — transferts chiffrés (E2EE)', () => {
  const controller = new TestableController(null as never, null as never);
  const toAccountId = '11111111-1111-4111-8111-111111111111';

  describe('toCreateValues — branche chiffrée', () => {
    it('Given un virement chiffré avec toAccountId, When create, Then toAccountId est conservé', () => {
      const values = controller.publicCreateValues({
        encryptedData: 'blob',
        toAccountId,
      });

      // Régression : sans toAccountId, le compte destination n'est jamais crédité.
      expect(values.toAccountId).toBe(toAccountId);
    });

    it('Given un virement chiffré sans toAccountId, When create, Then toAccountId vaut null', () => {
      const values = controller.publicCreateValues({ encryptedData: 'blob' });
      expect(values.toAccountId).toBeNull();
    });
  });

  describe('toUpdatePatch — branche chiffrée', () => {
    it('Given une édition chiffrée avec toAccountId, When update, Then toAccountId est propagé', () => {
      const patch = controller.publicUpdatePatch({
        encryptedData: 'blob',
        toAccountId,
      });
      expect(patch.toAccountId).toBe(toAccountId);
    });
  });
});

// Couverture HTTP multipart de POST /recurring-entries/:id/payslip.
// Champ multer attendu : FileInterceptor('payslip'). Un .attach() sous ce nom
// exact doit être parsé → storage.upload appelé → svc.update({ payslipKey }).

const ENTRY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('RecurringEntriesController — POST /recurring-entries/:id/payslip (multipart)', () => {
  let app: INestApplication;

  const mockSvc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const mockStorage = {
    payslipKey: vi.fn(() => 'payslips/u1/entry-1.pdf'),
    upload: vi.fn(),
    getStream: vi.fn(),
    delete: vi.fn(),
    deletePrefix: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RecurringEntriesController],
      providers: [
        { provide: RecurringEntriesService, useValue: mockSvc },
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
    mockSvc.getOne.mockReset().mockResolvedValue({ id: ENTRY_ID });
    mockSvc.update.mockReset().mockResolvedValue({
      id: ENTRY_ID,
      payslipKey: 'payslips/u1/entry-1.pdf',
    });
    mockStorage.payslipKey.mockClear();
    mockStorage.upload.mockReset().mockResolvedValue(undefined);
  });

  it("champ 'payslip' → 201, storage.upload appelé, svc.update reçoit { payslipKey }", async () => {
    const res = await request(app.getHttpServer())
      .post(`/recurring-entries/${ENTRY_ID}/payslip`)
      .attach('payslip', Buffer.from('%PDF-1.4'), 'f.pdf');

    expect(res.status).toBe(201);
    expect(mockSvc.getOne).toHaveBeenCalledWith('u1', ENTRY_ID);
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    expect(mockSvc.update).toHaveBeenCalledWith(
      'u1',
      ENTRY_ID,
      expect.objectContaining({ payslipKey: expect.any(String) }),
    );
  });

  it('sans fichier → 400 (BadRequestException), storage.upload jamais appelé', async () => {
    const res = await request(app.getHttpServer()).post(
      `/recurring-entries/${ENTRY_ID}/payslip`,
    );

    expect(res.status).toBe(400);
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('entrée inexistante → 404, storage.upload jamais appelé', async () => {
    mockSvc.getOne.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer())
      .post(`/recurring-entries/${ENTRY_ID}/payslip`)
      .attach('payslip', Buffer.from('%PDF-1.4'), 'f.pdf');

    expect(res.status).toBe(404);
    expect(mockStorage.upload).not.toHaveBeenCalled();
    expect(mockSvc.update).not.toHaveBeenCalled();
  });
});
