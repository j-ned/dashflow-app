import { AppError } from './errors';

export type ErrorBody = {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
};

// Erreurs Postgres (SQLSTATE) qui traduisent une entrée invalide ou un conflit, pas un bug :
// on répond 400/409 lisible au lieu d'un 500 générique remonté à Sentry.
export const PG_ERRORS: Record<
  string,
  { status: number; message: string; code: string }
> = {
  '23505': {
    status: 409,
    message: 'Cette valeur existe déjà',
    code: 'UNIQUE_VIOLATION',
  },
  '23503': {
    status: 409,
    message: 'Référence invalide ou encore utilisée',
    code: 'FOREIGN_KEY_VIOLATION',
  },
  '23514': {
    status: 400,
    message: 'Valeur incohérente avec les règles métier',
    code: 'CHECK_VIOLATION',
  },
  '23502': {
    status: 400,
    message: 'Champ obligatoire manquant',
    code: 'NOT_NULL_VIOLATION',
  },
  '22P02': {
    status: 400,
    message: 'Format de valeur invalide',
    code: 'INVALID_TEXT_REPRESENTATION',
  },
  '22001': {
    status: 400,
    message: 'Valeur trop longue',
    code: 'STRING_DATA_RIGHT_TRUNCATION',
  },
  '22003': {
    status: 400,
    message: 'Valeur numérique hors limites',
    code: 'NUMERIC_VALUE_OUT_OF_RANGE',
  },
  '22007': {
    status: 400,
    message: 'Format de date invalide',
    code: 'INVALID_DATETIME_FORMAT',
  },
  '22008': {
    status: 400,
    message: 'Date hors limites',
    code: 'DATETIME_FIELD_OVERFLOW',
  },
};

/** SQLSTATE d'une erreur postgres-js, y compris enveloppée par drizzle (`cause`). */
export function pgErrorCode(exception: unknown): string | undefined {
  let current: unknown = exception;
  for (
    let depth = 0;
    depth < 3 && current && typeof current === 'object';
    depth++
  ) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = cause;
  }
  return undefined;
}

/**
 * Erreur quelconque → statut + message exposables, hors exceptions propres à un framework HTTP
 * (que chaque couche HTTP traite avant d'appeler cette fonction). Tout l'inattendu devient un
 * 500 sans détail.
 */
export function normalizeError(exception: unknown): ErrorBody {
  if (exception instanceof AppError)
    return { status: exception.status, message: exception.message };
  const pg = pgErrorCode(exception);
  const mapped = pg ? PG_ERRORS[pg] : undefined;
  if (mapped) return { ...mapped };
  return { status: 500, message: 'Erreur interne du serveur' };
}

/** Nom du statut dans le champ `error`, tel que l'énumération HttpStatus de Nest l'écrivait. */
const STATUS_NAMES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

export const statusName = (status: number): string =>
  STATUS_NAMES[status] ?? 'ERROR';

/** Corps JSON d'erreur commun à toutes les couches HTTP. */
export function errorResponseBody(err: ErrorBody, path: string) {
  return {
    statusCode: err.status,
    error: statusName(err.status),
    message: err.message,
    ...(err.code ? { code: err.code } : {}),
    ...(err.details !== undefined ? { details: err.details } : {}),
    path,
    timestamp: new Date().toISOString(),
  };
}
