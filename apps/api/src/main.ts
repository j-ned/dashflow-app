// IMPORTANT : en tout premier — initialise Sentry avant tout autre import (auto-instrumentation).
import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';
import { NEXT_CURSOR_HEADER } from './common/crud/keyset';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // Déploiement derrière Traefik (Docker Swarm) : sans ce réglage, `req.ip` renvoie l'IP du
  // proxy pour toutes les requêtes → le throttler (clé par défaut = IP) bucketise tout le
  // trafic sous une seule clé (DoS auto-infligé sur les routes à quota strict).
  app.set('trust proxy', 1);

  // Le front est servi sur une autre origine : les ressources embarquées (avatar via <img>)
  // sont régies par CORP, pas CORS. `same-origin` (défaut Helmet) les bloquerait → cross-origin.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Une API JSON n'a aucune raison d'être encadrée : 'none' plutôt que le 'self' par défaut.
      frameguard: { action: 'deny' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'frame-ancestors': ["'none'"] },
      },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }).split(','),
    credentials: true,
    // Pagination par curseur : le front doit pouvoir lire l'en-tête de page suivante.
    exposedHeaders: [NEXT_CURSOR_HEADER],
  });
  // Arrêt propre. `enableShutdownHooks()` ne suffit pas dans un conteneur : une fois ses hooks
  // passés, Nest se renvoie le signal pour mourir, or le noyau ignore un signal à disposition par
  // défaut adressé au processus n° 1. L'API restait donc en vie jusqu'au SIGKILL de Docker (10 s,
  // code 137) à chaque déploiement. `app.close()` exécute les mêmes hooks ; on sort ensuite nous-mêmes.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void app.close().finally(() => process.exit(0));
    });
  }

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
