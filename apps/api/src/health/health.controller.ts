import {
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.constants';
import type { Env } from '../config/env.schema';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // Sonde de VIE (HEALTHCHECK Docker) : publique, sans détail et sans toucher la base. Elle ne doit
  // pas dépendre de Postgres : une base en panne ferait redémarrer l'API en boucle sans rien réparer.
  @Get()
  check(): { ok: true } {
    return { ok: true };
  }

  // État de la base, pour un monitoring : réservé à qui présente HEALTH_TOKEN. Sans jeton configuré,
  // ou avec un mauvais jeton, la route n'existe pas (404) plutôt que d'avouer qu'elle est protégée.
  @Get('ready')
  async ready(
    @Headers('x-health-token') presented?: string,
  ): Promise<{ ok: true; db: true }> {
    const expected = this.config.get('HEALTH_TOKEN', { infer: true });
    if (!expected || !presented || !sameToken(presented, expected)) {
      throw new NotFoundException('Non trouvé');
    }
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException('Base de données injoignable');
    }
    return { ok: true, db: true };
  }
}

function sameToken(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
