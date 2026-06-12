import { HttpException } from '@nestjs/common';
import type { Result } from './auth.result';

type ResultError = Extract<Result<unknown>, { success: false }>;

/** Traduit un échec du Result pattern en `HttpException` au bord du controller. */
export function httpFrom(r: ResultError): HttpException {
  return new HttpException(
    r.code ? { message: r.error, code: r.code } : r.error,
    r.status,
  );
}
