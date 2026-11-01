import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

type Normalized = {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
};

// Erreurs Postgres (SQLSTATE) qui traduisent une entrée invalide ou un conflit, pas un bug :
// on répond 400/409 lisible au lieu d'un 500 générique remonté à Sentry.
const PG_ERRORS: Record<
  string,
  { status: number; message: string; code: string }
> = {
  '23505': {
    status: HttpStatus.CONFLICT,
    message: 'Cette valeur existe déjà',
    code: 'UNIQUE_VIOLATION',
  },
  '23503': {
    status: HttpStatus.CONFLICT,
    message: 'Référence invalide ou encore utilisée',
    code: 'FOREIGN_KEY_VIOLATION',
  },
  '23514': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Valeur incohérente avec les règles métier',
    code: 'CHECK_VIOLATION',
  },
  '23502': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Champ obligatoire manquant',
    code: 'NOT_NULL_VIOLATION',
  },
  '22P02': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Format de valeur invalide',
    code: 'INVALID_TEXT_REPRESENTATION',
  },
  '22001': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Valeur trop longue',
    code: 'STRING_DATA_RIGHT_TRUNCATION',
  },
  '22003': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Valeur numérique hors limites',
    code: 'NUMERIC_VALUE_OUT_OF_RANGE',
  },
  '22007': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Format de date invalide',
    code: 'INVALID_DATETIME_FORMAT',
  },
  '22008': {
    status: HttpStatus.BAD_REQUEST,
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

export function normalizeException(exception: unknown): Normalized {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const resp = exception.getResponse();
    if (typeof resp === 'string') return { status, message: resp };
    if (resp && typeof resp === 'object') {
      const r = resp as {
        message?: unknown;
        code?: unknown;
        details?: unknown;
      };
      const message =
        typeof r.message === 'string'
          ? r.message
          : Array.isArray(r.message)
            ? r.message.join(', ')
            : exception.message;
      return {
        status,
        message,
        ...(typeof r.code === 'string' ? { code: r.code } : {}),
        ...(r.details !== undefined ? { details: r.details } : {}),
      };
    }
    return { status, message: exception.message };
  }
  const pg = pgErrorCode(exception);
  const mapped = pg ? PG_ERRORS[pg] : undefined;
  if (mapped) return { ...mapped };
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Erreur interne du serveur',
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, message, code, details } = normalizeException(exception);

    if (status >= 500) {
      // Uniquement les erreurs serveur : on ne remonte PAS les 4xx (401/404/409…) à Sentry
      // pour éviter le bruit. Inerte si Sentry n'est pas initialisé (SENTRY_DSN absent).
      Sentry.captureException(exception);
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'ERROR',
      message,
      ...(code ? { code } : {}),
      ...(details !== undefined ? { details } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
