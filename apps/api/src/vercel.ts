// IMPORTANT : en tout premier — initialise Sentry avant tout autre import (auto-instrumentation).
import './instrument';
import { envSchema } from './config/env.schema';
import { createApp } from './http/app';
import { createDeps } from './http/deps';

/**
 * Point d'entrée Vercel (service `api` de vercel.json) : la fonction reçoit les requêtes /api/*
 * avec leur chemin complet. Pas de serve() ni d'horloge interne : Vercel gère le cycle de vie et
 * déclenche les tâches de fond via /api/cron/* (cf. routes/cron.ts).
 */
const { deps } = createDeps(envSchema.parse(process.env));

export default createApp(deps, { basePath: '/api' });
