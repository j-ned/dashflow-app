import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

// Couverture HTTP multipart de POST /prescriptions/:id/document.
// Champ multer attendu : FileInterceptor('document'). Un .attach() sous ce nom
// exact doit être parsé → storage.upload appelé → svc.update({ documentUrl }).

const PRESC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('PrescriptionsController — POST /prescriptions/:id/document (multipart)', () => {
  let app: INestApplication;

  const mockSvc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    byAppointment: vi.fn(),
  };

  const mockStorage = {
    prescriptionKey: vi.fn(() => 'prescriptions/u1/presc-1.pdf'),
    upload: vi.fn(),
    getStream: vi.fn(),
    delete: vi.fn(),
    deletePrefix: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PrescriptionsController],
      providers: [
        { provide: PrescriptionsService, useValue: mockSvc },
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
    mockSvc.getOne.mockReset().mockResolvedValue({ id: PRESC_ID });
    mockSvc.update.mockReset().mockResolvedValue({ id: PRESC_ID, documentUrl: 'prescriptions/u1/presc-1.pdf' });
    mockStorage.prescriptionKey.mockClear();
    mockStorage.upload.mockReset().mockResolvedValue(undefined);
  });

  it("champ 'document' → 201, storage.upload appelé, svc.update reçoit { documentUrl }", async () => {
    const res = await request(app.getHttpServer())
      .post(`/prescriptions/${PRESC_ID}/document`)
      .attach('document', Buffer.from('%PDF-1.4'), 'f.pdf');

    expect(res.status).toBe(201);
    expect(mockSvc.getOne).toHaveBeenCalledWith('u1', PRESC_ID);
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    expect(mockSvc.update).toHaveBeenCalledWith(
      'u1',
      PRESC_ID,
      expect.objectContaining({ documentUrl: expect.any(String) }),
    );
  });

  it('sans fichier → 400 (BadRequestException), storage.upload jamais appelé', async () => {
    const res = await request(app.getHttpServer()).post(`/prescriptions/${PRESC_ID}/document`);

    expect(res.status).toBe(400);
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('prescription inexistante → 404, storage.upload jamais appelé', async () => {
    mockSvc.getOne.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer())
      .post(`/prescriptions/${PRESC_ID}/document`)
      .attach('document', Buffer.from('%PDF-1.4'), 'f.pdf');

    expect(res.status).toBe(404);
    expect(mockStorage.upload).not.toHaveBeenCalled();
    expect(mockSvc.update).not.toHaveBeenCalled();
  });
});
