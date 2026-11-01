import type { CookieOptions } from 'express';

/**
 * Nom du cookie de session. En production, préfixe `__Host-` (RFC 6265bis) : le navigateur
 * n'accepte le cookie que s'il est Secure, Path=/ et sans Domain → un sous-domaine frère
 * compromis ne peut ni le poser ni l'écraser (cookie tossing).
 */
export const SESSION_COOKIE = 'dashflow_session';
export const SESSION_COOKIE_HOST = '__Host-dashflow_session';
export const sessionCookieName = (isProd: boolean): string =>
  isProd ? SESSION_COOKIE_HOST : SESSION_COOKIE;
/** Les deux noms, pour lire une session posée avant le passage au préfixe. */
export const SESSION_COOKIE_NAMES = [
  SESSION_COOKIE_HOST,
  SESSION_COOKIE,
] as const;

export const CSRF_HEADER = 'x-csrf-token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function sessionCookieOptions(isProd: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}

export const OAUTH_STATE_COOKIE = 'dashflow_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'dashflow_oauth_verifier';

export function oauthCookieOptions(isProd: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 600_000,
  };
}
