import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';
import {
  errorResponseBody,
  normalizeError,
  pgErrorCode,
  type ErrorBody,
} from '../error-response';

export { pgErrorCode };

export function normalizeException(exception: unknown): ErrorBody {
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
  return normalizeError(exception);
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const normalized = normalizeException(exception);
    const { status } = normalized;

    if (status >= 500) {
      // Uniquement les erreurs serveur : on ne remonte PAS les 4xx (401/404/409…) à Sentry
      // pour éviter le bruit. Inerte si Sentry n'est pas initialisé (SENTRY_DSN absent).
      Sentry.captureException(exception);
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json(errorResponseBody(normalized, req.url));
  }
}
