import { describe, it, expect } from 'vitest';
import {
  assertUploadable,
  resolveUploadMimeType,
  uploadErrorKey,
  UploadFileError,
  UPLOAD_MAX_BYTES,
} from './upload-file-policy';

const file = (name: string, type: string, size = 10): File =>
  new File([new Uint8Array(size)], name, { type });

describe('upload-file-policy', () => {
  it.each([
    ['a.pdf', 'application/pdf'],
    ['a.jpg', 'image/jpeg'],
    ['a.png', 'image/png'],
    ['a.webp', 'image/webp'],
  ])('given %s (%s), when assertUploadable, then accepté', (name, type) => {
    expect(() => assertUploadable(file(name, type))).not.toThrow();
  });

  it.each([
    ['virus.exe', 'application/x-msdownload'],
    ['a.svg', 'image/svg+xml'],
    ['a.gif', 'image/gif'],
    ['a.txt', 'text/plain'],
  ])('given %s (%s), when assertUploadable, then UploadFileError invalidType', (name, type) => {
    expect(() => assertUploadable(file(name, type))).toThrow(UploadFileError);
    try {
      assertUploadable(file(name, type));
    } catch (e) {
      expect((e as UploadFileError).reason).toBe('invalidType');
    }
  });

  it('given un type vide mais une extension connue (drag-and-drop), then MIME déduit et accepté', () => {
    expect(resolveUploadMimeType(file('scan.JPG', ''))).toBe('image/jpeg');
    expect(() => assertUploadable(file('scan.JPG', ''))).not.toThrow();
  });

  it('given un type vide et une extension inconnue, then refusé', () => {
    expect(() => assertUploadable(file('scan.bin', ''))).toThrow(UploadFileError);
  });

  it('given un fichier > 10 Mo, then UploadFileError tooLarge', () => {
    const big = file('a.pdf', 'application/pdf', UPLOAD_MAX_BYTES + 1);
    expect(() => assertUploadable(big)).toThrow(UploadFileError);
    expect(
      uploadErrorKey(
        (() => {
          try {
            assertUploadable(big);
          } catch (e) {
            return e;
          }
          return null;
        })(),
      ),
    ).toBe('shared.upload.tooLarge');
  });

  it('given exactement 10 Mo, then accepté', () => {
    expect(() =>
      assertUploadable(file('a.pdf', 'application/pdf', UPLOAD_MAX_BYTES)),
    ).not.toThrow();
  });

  it('uploadErrorKey : clé i18n pour UploadFileError, null pour toute autre erreur', () => {
    expect(uploadErrorKey(new UploadFileError('invalidType'))).toBe('shared.upload.invalidType');
    expect(uploadErrorKey(new Error('http 500'))).toBeNull();
    expect(uploadErrorKey(undefined)).toBeNull();
  });
});
