import { createMiddleware } from 'hono/factory';
import type { IncomingMessage } from 'node:http';
import type { AppEnv } from '../types';

/**
 * Adresse du client. Derrière un tunnel Cloudflare, le relais (Traefik puis le nginx du front) ne
 * voit que des adresses internes : l'adresse du visiteur est dans l'en-tête que le tunnel pose
 * (`CLIENT_IP_HEADER`, ex. `cf-connecting-ip`). Cet en-tête n'est digne de confiance que si rien
 * d'autre que le tunnel ne joint le serveur ; sans réglage, il est ignoré.
 * Sinon, derrière UN reverse-proxy de confiance (Traefik) : l'entrée la plus à droite de
 * `X-Forwarded-For`, celle que le proxy a ajoutée — jamais la plus à gauche, que le client choisit
 * librement. Sans l'en-tête, l'adresse de la socket. Sans ce réglage, tout le trafic partagerait
 * un seul compteur de throttling.
 */
export function resolveClientIp(
  trustedHeader: string | undefined,
  forwardedFor: string | undefined,
  socketAddress: string | undefined,
): string {
  const trusted = trustedHeader?.trim();
  if (trusted) return trusted;
  const hops = (forwardedFor ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  return hops.at(-1) ?? socketAddress ?? 'unknown';
}

type NodeBindings = { incoming?: IncomingMessage };

export const clientIp = (trustedHeaderName?: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const socket = (c.env as NodeBindings | undefined)?.incoming?.socket;
    c.set(
      'clientIp',
      resolveClientIp(
        trustedHeaderName ? c.req.header(trustedHeaderName) : undefined,
        c.req.header('x-forwarded-for'),
        socket?.remoteAddress,
      ),
    );
    await next();
  });
