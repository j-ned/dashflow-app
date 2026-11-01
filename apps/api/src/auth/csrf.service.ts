import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import type { Env } from '../config/env.schema';

/**
 * Jeton anti-CSRF lié à la session : HMAC-SHA256(clé dérivée de JWT_SECRET, `${userId}:${sv}`).
 *
 * Remplace le double-submit par cookie : plus de cookie CSRF à poser (donc rien à « tosser »
 * depuis un sous-domaine frère), et le jeton meurt avec la session (logout, reset, changement
 * de mot de passe incrémentent `sv`). Il est renvoyé par GET /auth/csrf et par les réponses de
 * connexion ; le front le met dans `X-CSRF-Token` sur chaque mutation.
 */
export class CsrfService {
  private readonly key: Buffer;

  constructor(config: Pick<Env, 'JWT_SECRET'>) {
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        config.JWT_SECRET,
        'dashflow-csrf',
        'csrf-token-v1',
        32,
      ),
    );
  }

  tokenFor(userId: string, sessionVersion: number): string {
    return createHmac('sha256', this.key)
      .update(`${userId}:${sessionVersion}`, 'utf8')
      .digest('base64url');
  }

  verify(token: unknown, userId: string, sessionVersion: number): boolean {
    if (typeof token !== 'string' || token.length === 0) return false;
    const expected = Buffer.from(this.tokenFor(userId, sessionVersion));
    const given = Buffer.from(token);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
