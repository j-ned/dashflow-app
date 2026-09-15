import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { assertOwnedStorageKey } from './storage-key';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('assertOwnedStorageKey', () => {
  it('accepte une clé sous le préfixe de l’utilisateur', () => {
    expect(
      assertOwnedStorageKey(ME, `documents/${ME}/doc.pdf`, 'documents'),
    ).toBe(`documents/${ME}/doc.pdf`);
  });

  it.each([
    ['clé d’un autre utilisateur', `documents/${OTHER}/doc.pdf`, 'documents'],
    ['mauvais préfixe', `prescriptions/${ME}/doc.pdf`, 'documents'],
    ['traversal', `documents/${ME}/../${OTHER}/doc.pdf`, 'documents'],
    ['préfixe seul sans séparateur', `documents/${ME}x/doc.pdf`, 'documents'],
    ['clé vide', '', 'payslips'],
  ] as const)('refuse : %s', (_label, key, prefix) => {
    expect(() => assertOwnedStorageKey(ME, key, prefix)).toThrow(
      NotFoundException,
    );
  });
});
