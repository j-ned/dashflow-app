import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UploadPolicy } from './upload-policy';
import type { AuthRepository } from '../../auth/auth.repository';

// %PDF-1.4 : magic-bytes reconnus par file-type comme application/pdf.
const PDF = {
  buffer: Buffer.from('%PDF-1.4\n%âãÏÓ\n'),
  mimetype: 'application/pdf',
};
// Blob chiffré AES-GCM (IV + ciphertext) : aucun magic-bytes reconnaissable.
const OPAQUE = {
  buffer: Buffer.from([0x9f, 0x12, 0x00, 0xff, 0x33, 0x7a, 0x01, 0x42]),
  mimetype: 'application/octet-stream',
};

describe('UploadPolicy', () => {
  const repo = { findById: vi.fn() };
  let policy: UploadPolicy;

  beforeEach(() => {
    repo.findById.mockReset();
    policy = new UploadPolicy(repo as unknown as AuthRepository);
  });

  it('given compte E2EE, when blob octet-stream, then accepté sans lecture du contenu', async () => {
    repo.findById.mockResolvedValue({ id: 'u1', encryptionVersion: 1 });

    await expect(policy.assertValid('u1', OPAQUE)).resolves.toBeUndefined();
    expect(repo.findById).toHaveBeenCalledWith('u1');
  });

  it('given compte en clair, when blob octet-stream, then 400 (pas de contournement des magic-bytes)', async () => {
    repo.findById.mockResolvedValue({ id: 'u1', encryptionVersion: 0 });

    await expect(policy.assertValid('u1', OPAQUE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('given utilisateur inconnu, when blob octet-stream, then 400', async () => {
    repo.findById.mockResolvedValue(undefined);

    await expect(policy.assertValid('u1', OPAQUE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('given compte E2EE, when PDF en clair déclaré PDF, then accepté (mode clair toujours possible)', async () => {
    repo.findById.mockResolvedValue({ id: 'u1', encryptionVersion: 1 });

    await expect(policy.assertValid('u1', PDF)).resolves.toBeUndefined();
    // Pas de lookup inutile pour un MIME non opaque.
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('given compte E2EE, when contenu opaque déclaré PDF, then 400 (magic-bytes appliqués)', async () => {
    repo.findById.mockResolvedValue({ id: 'u1', encryptionVersion: 1 });

    await expect(
      policy.assertValid('u1', { ...OPAQUE, mimetype: 'application/pdf' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
