import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'dashflow_session';
export const CSRF_COOKIE = 'dashflow_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions(isProd: boolean): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/', maxAge: SEVEN_DAYS_MS };
}
export function csrfCookieOptions(isProd: boolean): CookieOptions {
  return { httpOnly: false, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/', maxAge: SEVEN_DAYS_MS };
}
