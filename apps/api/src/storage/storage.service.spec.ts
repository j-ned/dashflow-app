import { describe, it, expect } from 'vitest';
import { StorageService } from './storage.service';

const cfg = (configured: boolean) => ({ get: (k: string) => configured
  ? ({ S3_ENDPOINT:'https://x.r2.cloudflarestorage.com', S3_REGION:'auto', S3_ACCESS_KEY_ID:'a', S3_SECRET_ACCESS_KEY:'b', S3_BUCKET:'dashflow-app' } as any)[k]
  : ({ S3_REGION:'auto' } as any)[k] });

describe('StorageService key builders', () => {
  const svc = new StorageService(cfg(true) as any);
  it('avatarKey png', () => { expect(svc.avatarKey('u1','image/png')).toBe('avatars/u1.png'); });
  it('avatarKey jpeg→jpg', () => { expect(svc.avatarKey('u1','image/jpeg')).toBe('avatars/u1.jpg'); });
  it('prescriptionKey', () => { expect(svc.prescriptionKey('u1','p1','application/pdf')).toBe('prescriptions/u1/p1.pdf'); });
  it('documentKey', () => { expect(svc.documentKey('u1','d1','application/pdf')).toBe('documents/u1/d1.pdf'); });
  it('payslipKey', () => { expect(svc.payslipKey('u1','e1','application/pdf')).toBe('payslips/u1/e1.pdf'); });
});

describe('StorageService non configuré', () => {
  it('upload lance si pas de client', async () => {
    const svc = new StorageService(cfg(false) as any);
    await expect(svc.upload('k', Buffer.from('x'), 'text/plain')).rejects.toThrow();
  });
  it('delete ne lance pas si pas de client', async () => {
    const svc = new StorageService(cfg(false) as any);
    await expect(svc.delete('k')).resolves.toBeUndefined();
  });
});
