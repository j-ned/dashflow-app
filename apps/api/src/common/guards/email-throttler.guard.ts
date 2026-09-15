import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limite par adresse e-mail ciblée (et non par IP appelante) sur les routes qui vérifient un
 * code ou un mot de passe pour un compte donné : `verify`, `reset-password`, `login`...
 *
 * Le ThrottlerGuard global (APP_GUARD) compte par IP ; un attaquant distribué sur N adresses
 * obtient N × la limite contre UN compte. Ce garde ajoute un second compteur, clé = e-mail
 * du body, avec la même config `@Throttle` que la route. Sans e-mail dans le body, il se
 * comporte comme le garde par IP.
 */
@Injectable()
export class EmailThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email) return `email:${email}`;
    return super.getTracker(req);
  }
}
