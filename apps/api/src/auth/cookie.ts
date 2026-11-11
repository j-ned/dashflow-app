/** Réglages d'un cookie, indépendants du framework (`maxAge` en millisecondes). */
export type CookieSettings = {
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: 'lax' | 'strict';
  readonly path: string;
  readonly maxAge?: number;
};

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

/**
 * `SameSite=Lax` partout : le front et l'API sont sur le même site (même origine derrière /api,
 * et déjà même site entre `dashflow.` et `api-dashflow.nedellec-julien.fr`). `None` exposait le
 * cookie à toute requête intersite, ce dont l'app n'a jamais eu besoin.
 */
export function sessionCookieOptions(isProd: boolean): CookieSettings {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}

export const OAUTH_STATE_COOKIE = 'dashflow_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'dashflow_oauth_verifier';

export function oauthCookieOptions(isProd: boolean): CookieSettings {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 600_000,
  };
}

/**
 * Preuve « Google validé, second facteur en attente » d'un compte 2FA (cf. routes/oauth.ts).
 * Jamais dans l'URL de redirection : un cookie HttpOnly, de la durée de vie de la preuve, que le
 * navigateur ne renvoie qu'à la route qui la vérifie.
 */
export const OAUTH_MFA_COOKIE = 'dashflow_oauth_mfa';
export const OAUTH_MFA_PATH = '/auth/oauth/google/mfa';

/**
 * `apiUrl` est l'adresse publique de l'API (APP_URL), celle du retour Google : son chemin
 * (`/api` derrière la même origine que le front) préfixe celui du cookie, vu du navigateur.
 */
export function oauthMfaCookieOptions(
  isProd: boolean,
  apiUrl: string,
  maxAgeMs: number,
): CookieSettings {
  const prefix = new URL(apiUrl).pathname.replace(/\/+$/, '');
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: `${prefix}${OAUTH_MFA_PATH}`,
    maxAge: maxAgeMs,
  };
}
