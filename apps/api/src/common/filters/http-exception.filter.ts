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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extrait message + un éventuel `code` machine (ex. TOTP_REQUIRED) du body d'exception.
    let message = 'Erreur interne du serveur';
    let code: string | undefined;
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        const r = resp as { message?: unknown; code?: unknown };
        message =
          typeof r.message === 'string'
            ? r.message
            : Array.isArray(r.message)
              ? r.message.join(', ')
              : exception.message;
        if (typeof r.code === 'string') code = r.code;
      } else {
        message = exception.message;
      }
    }

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
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
