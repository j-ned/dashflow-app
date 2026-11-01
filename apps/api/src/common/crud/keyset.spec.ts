import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  decodeCursor,
  encodeCursor,
  parsePageQuery,
  toPage,
  toPageByCreatedAt,
  DEFAULT_PAGE_SIZE,
  pageLimit,
} from './keyset';

describe('keyset pagination', () => {
  it('encode/decode : aller-retour et arité vérifiée', () => {
    const c = encodeCursor(['2026-09-16T10:00:00.123456Z', 'abc']);
    expect(decodeCursor(c, 2)).toEqual(['2026-09-16T10:00:00.123456Z', 'abc']);
    expect(() => decodeCursor(c, 1)).toThrow(BadRequestException);
    expect(decodeCursor(undefined, 2)).toBeUndefined();
  });

  it('decode : curseur forgé (pas du base64 JSON de chaînes) → 400', () => {
    expect(() => decodeCursor('not-a-cursor', 2)).toThrow(BadRequestException);
    const notStrings = Buffer.from(JSON.stringify([1, 2])).toString(
      'base64url',
    );
    expect(() => decodeCursor(notStrings, 2)).toThrow(BadRequestException);
  });

  it('parsePageQuery : coercition, bornes, défaut', () => {
    expect(parsePageQuery({ limit: '10' })).toEqual({ limit: 10 });
    expect(pageLimit(parsePageQuery({}))).toBe(DEFAULT_PAGE_SIZE);
    expect(() => parsePageQuery({ limit: '0' })).toThrow(BadRequestException);
    expect(() => parsePageQuery({ limit: '5000' })).toThrow(
      BadRequestException,
    );
  });

  it('toPage : la ligne excédentaire est retirée et devient le curseur', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const page = toPage(rows, 2, (r) => [r.id]);
    expect(page.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(decodeCursor(page.nextCursor!, 1)).toEqual(['b']);
    expect(toPage(rows, 3, (r) => [r.id]).nextCursor).toBeNull();
  });

  it('toPageByCreatedAt : retire la colonne technique et encode (created_at, id)', () => {
    const rows = [
      { id: 'a', v: 1, _cursor: 'T1' },
      { id: 'b', v: 2, _cursor: 'T2' },
    ];
    const page = toPageByCreatedAt(rows, 1);
    expect(page.items).toEqual([{ id: 'a', v: 1 }]);
    expect(decodeCursor(page.nextCursor!, 2)).toEqual(['T1', 'a']);
  });
});
