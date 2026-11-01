import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import { TokenService } from '../../auth/token.service';
import { SESSION_COOKIE_NAMES } from '../../auth/cookie';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { users } from '../../db/schema';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly token: TokenService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = SESSION_COOKIE_NAMES.map((n) => cookies?.[n]).find(Boolean);
    if (!raw) throw new UnauthorizedException('Non authentifié');

    let payload: Awaited<ReturnType<TokenService['verify']>>;
    try {
      payload = await this.token.verify(raw);
    } catch {
      throw new UnauthorizedException('Session invalide');
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
      throw new UnauthorizedException('Session révoquée');
    }

    (req as Request & { user: unknown }).user = {
      id: payload.sub,
      email: payload.email,
      sessionVersion: payload.sv,
      isDemo: payload.demo === true,
    };
    return true;
  }
}
