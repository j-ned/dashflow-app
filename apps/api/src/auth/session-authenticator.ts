import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../db/drizzle.constants';
import { users } from '../db/schema';
import { UnauthorizedError } from '../common/errors';
import type { AuthUser } from './auth-user';
import { SESSION_COOKIE_NAMES } from './cookie';
import type { TokenService } from './token.service';

/**
 * Authentification par cookie de session, commune aux couches HTTP : cookie → JWT → version de
 * session en base. Lève `UnauthorizedError` avec les messages historiques de JwtAuthGuard.
 */
export class SessionAuthenticator {
  constructor(
    private readonly token: TokenService,
    private readonly db: DrizzleDB,
  ) {}

  async authenticate(
    cookies: Readonly<Record<string, string | undefined>> | undefined,
  ): Promise<AuthUser> {
    const raw = SESSION_COOKIE_NAMES.map((n) => cookies?.[n]).find(Boolean);
    if (!raw) throw new UnauthorizedError('Non authentifié');

    let payload: Awaited<ReturnType<TokenService['verify']>>;
    try {
      payload = await this.token.verify(raw);
    } catch {
      throw new UnauthorizedError('Session invalide');
    }

    // Révocation : un SELECT par clé primaire à chaque requête authentifiée. C'est le prix d'un
    // logout / reset de mot de passe qui invalide réellement les tokens déjà émis (ASVS 3.3).
    const rows = await this.db
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    const current = rows[0]?.sessionVersion;
    if (current === undefined || current !== payload.sv) {
      throw new UnauthorizedError('Session révoquée');
    }

    return {
      id: payload.sub,
      email: payload.email,
      sessionVersion: payload.sv,
      isDemo: payload.demo === true,
    };
  }
}
