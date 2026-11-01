import { createMiddleware } from 'hono/factory';
import type { IncomingMessage } from 'node:http';
import type { AppEnv } from '../types';

/**
 * Adresse du client derrière UN reverse-proxy de confiance (Traefik) : l'entrée la plus à droite
 * de `X-Forwarded-For`, celle que le proxy a ajoutée — jamais la plus à gauche, que le client
 * choisit librement. Sans l'en-tête, l'adresse de la socket. Équivaut à `trust proxy: 1`
 * d'Express ; sans ce réglage, tout le trafic partagerait un seul compteur de throttling.
 */
export function resolveClientIp(
  forwardedFor: string | undefined,
  socketAddress: string | undefined,
): string {
  const hops = (forwardedFor ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  return hops.at(-1) ?? socketAddress ?? 'unknown';
}

type NodeBindings = { incoming?: IncomingMessage };

export const clientIp = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const socket = (c.env as NodeBindings | undefined)?.incoming?.socket;
    c.set(
      'clientIp',
      resolveClientIp(c.req.header('x-forwarded-for'), socket?.remoteAddress),
    );
    await next();
  });
