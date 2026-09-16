import { BadRequestException } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';

/**
 * Pagination par curseur (keyset), rétrocompatible : la réponse reste un tableau, et la
 * présence d'une page suivante est signalée par l'en-tête `X-Next-Cursor`. Un client qui
 * ignore l'en-tête obtient la première page comme avant ; un client qui le suit obtient tout.
 *
 * Le curseur est opaque (base64url d'un tableau JSON de chaînes) et ne contient jamais de
 * donnée métier : uniquement l'horodatage d'insertion et l'id de la dernière ligne servie.
 */
export const DEFAULT_PAGE_SIZE = 500;
export const MAX_PAGE_SIZE = 1000;
export const NEXT_CURSOR_HEADER = 'X-Next-Cursor';

export type PageQuery = { limit?: number; after?: string };
export type Page<T> = { items: T[]; nextCursor: string | null };

const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  after: z.string().min(1).max(512).optional(),
});

export function parsePageQuery(query: unknown): PageQuery {
  const r = pageQuerySchema.safeParse(query ?? {});
  if (!r.success) {
    throw new BadRequestException('Paramètres de pagination invalides');
  }
  return r.data;
}

export const pageLimit = (q: PageQuery): number => q.limit ?? DEFAULT_PAGE_SIZE;

export function encodeCursor(parts: readonly string[]): string {
  return Buffer.from(JSON.stringify(parts), 'utf8').toString('base64url');
}

export function decodeCursor(
  cursor: string | undefined,
  arity: number,
): string[] | undefined {
  if (cursor === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      Array.isArray(parsed) &&
      parsed.length === arity &&
      parsed.every((p) => typeof p === 'string')
    ) {
      return parsed;
    }
  } catch {
    /* curseur illisible → 400 ci-dessous */
  }
  throw new BadRequestException('Curseur de pagination invalide');
}

/** `rows` doit avoir été lu avec `limit + 1` lignes : la ligne excédentaire prouve la suite. */
export function toPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (last: T) => readonly string[],
): Page<T> {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  return {
    items,
    nextCursor: encodeCursor(cursorOf(items[items.length - 1])),
  };
}

// ── Keyset (created_at, id) ─────────────────────────────────────────────────────────────────
// Ordre stable même quand `date` est un placeholder E2EE. L'horodatage voyage en texte
// microseconde (to_char) : un `Date` JS tronque à la milliseconde et ferait sauter des lignes
// insérées dans la même milliseconde (cas courant du POST /batch).

export const CURSOR_COLUMN = '_cursor' as const;

export const createdAtCursorText = (col: PgColumn): SQL<string> =>
  sql<string>`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export function afterCreatedAt(
  createdAt: PgColumn,
  id: PgColumn,
  after: string | undefined,
  direction: 'asc' | 'desc',
): SQL | undefined {
  const c = decodeCursor(after, 2);
  if (!c) return undefined;
  return direction === 'desc'
    ? sql`(${createdAt}, ${id}) < (${c[0]}::timestamptz, ${c[1]}::uuid)`
    : sql`(${createdAt}, ${id}) > (${c[0]}::timestamptz, ${c[1]}::uuid)`;
}

type WithCursor = { id: string; [CURSOR_COLUMN]: string };

/** Variante de `toPage` pour les requêtes qui ont sélectionné `CURSOR_COLUMN` ; la retire. */
export function toPageByCreatedAt<T extends WithCursor>(
  rows: T[],
  limit: number,
): Page<Omit<T, typeof CURSOR_COLUMN>> {
  const more = rows.length > limit;
  const kept = more ? rows.slice(0, limit) : rows;
  const last = kept[kept.length - 1];
  const items = kept.map((row) => {
    const { [CURSOR_COLUMN]: _cursor, ...rest } = row;
    return rest;
  });
  return {
    items,
    nextCursor:
      more && last ? encodeCursor([last[CURSOR_COLUMN], last.id]) : null,
  };
}

// ── Keyset (id) ─────────────────────────────────────────────────────────────────────────────

export function afterId(
  id: PgColumn,
  after: string | undefined,
): SQL | undefined {
  const c = decodeCursor(after, 1);
  if (!c) return undefined;
  return sql`${id} > ${c[0]}::uuid`;
}

// ── Réponse HTTP ────────────────────────────────────────────────────────────────────────────

/** Pose `X-Next-Cursor` s'il y a une suite et renvoie le tableau (forme inchangée pour le front). */
export function sendPage<T>(
  res: { setHeader(name: string, value: string): unknown },
  page: Page<T>,
): T[] {
  if (page.nextCursor) res.setHeader(NEXT_CURSOR_HEADER, page.nextCursor);
  return page.items;
}
