// IMPORTANT : en tout premier — initialise Sentry avant tout autre import (auto-instrumentation).
import './instrument';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  // Déploiement derrière Traefik (Docker Swarm) : sans ce réglage, `req.ip` renvoie l'IP du
  // proxy pour toutes les requêtes → le throttler (clé par défaut = IP) bucketise tout le
  // trafic sous une seule clé (DoS auto-infligé sur les routes à quota strict).
  app.set('trust proxy', 1);

  // Le front est servi sur une autre origine : les ressources embarquées (avatar via <img>)
  // sont régies par CORP, pas CORS. `same-origin` (défaut Helmet) les bloquerait → cross-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }).split(','),
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
