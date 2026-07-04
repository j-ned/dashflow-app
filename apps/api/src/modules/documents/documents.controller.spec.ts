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
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageService } from '../../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';

// Couverture HTTP multipart de POST /documents/:id/file.
// Champ multer attendu : FileInterceptor('file'). Un .attach() sous ce nom
// exact doit être parsé → storage.upload appelé → svc.update({ fileUrl }).

const DOC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('DocumentsController — POST /documents/:id/file (multipart)', () => {
  let app: INestApplication;

  const mockSvc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    byPatient: vi.fn(),
  };

  const mockStorage = {
    documentKey: vi.fn(() => 'documents/u1/doc-1.pdf'),
    upload: vi.fn(),
    getStream: vi.fn(),
    delete: vi.fn(),
    deletePrefix: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: mockSvc },
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
    mockSvc.getOne.mockReset().mockResolvedValue({ id: DOC_ID });
    mockSvc.update
      .mockReset()
      .mockResolvedValue({ id: DOC_ID, fileUrl: 'documents/u1/doc-1.pdf' });
    mockStorage.documentKey.mockClear();
    mockStorage.upload.mockReset().mockResolvedValue(undefined);
  });

  it("champ 'file' → 201, storage.upload appelé, svc.update reçoit { fileUrl }", async () => {
    const res = await request(app.getHttpServer())
      .post(`/documents/${DOC_ID}/file`)
      .attach('file', Buffer.from('%PDF-1.4'), 'f.pdf');

    expect(res.status).toBe(201);
    expect(mockSvc.getOne).toHaveBeenCalledWith('u1', DOC_ID);
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    expect(mockSvc.update).toHaveBeenCalledWith(
      'u1',
      DOC_ID,
      expect.objectContaining({ fileUrl: expect.any(String) }),
    );
  });

  it('sans fichier → 400 (BadRequestException), storage.upload jamais appelé', async () => {
    const res = await request(app.getHttpServer()).post(
      `/documents/${DOC_ID}/file`,
    );

    expect(res.status).toBe(400);
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('document inexistant → 404, storage.upload jamais appelé', async () => {
    mockSvc.getOne.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer())
      .post(`/documents/${DOC_ID}/file`)
      .attach('file', Buffer.from('%PDF-1.4'), 'f.pdf');

    expect(res.status).toBe(404);
    expect(mockStorage.upload).not.toHaveBeenCalled();
    expect(mockSvc.update).not.toHaveBeenCalled();
  });
});
