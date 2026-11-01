import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startApi, type E2eApi } from './e2e/api-server';

/**
 * Parité du socle HTTP : la même requête envoyée à l'API Nest et à l'API Hono doit produire le
 * même statut, le même corps (horodatage mis à part) et les mêmes en-têtes de sécurité, CORS et
 * throttling. Les écarts VOULUS sont listés à part (cf. « améliorations »).
 * À supprimer avec l'implémentation Nest.
 */
const NEST = 'node dist/main.js';
const HONO = 'node dist/http/server.js';
const FRONT = 'http://localhost:4200';
const HEALTH_TOKEN = 'parity-health-token-0123456789';

const COMPARED_HEADERS = [
  'content-security-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'origin-agent-cluster',
  'referrer-policy',
  'strict-transport-security',
  'x-content-type-options',
  'x-dns-prefetch-control',
  'x-download-options',
  'x-frame-options',
  'x-permitted-cross-domain-policies',
  'x-xss-protection',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'x-ratelimit-limit',
  'x-ratelimit-reset',
  'retry-after',
];

type Snapshot = {
  status: number;
  body: unknown;
  headers: Record<string, string | null>;
};

async function snapshot(
  url: string,
  path: string,
  init?: RequestInit,
): Promise<Snapshot> {
  const res = await fetch(url + path, init);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text) as unknown;
    if (body && typeof body === 'object' && 'timestamp' in body)
      body = { ...body, timestamp: '<ts>' };
  } catch {
    // corps vide (204) ou non JSON : comparé tel quel
  }
  const headers = Object.fromEntries(
    COMPARED_HEADERS.map((h) => [h, res.headers.get(h)]),
  );
  // `Vary` : même ensemble de valeurs, quel que soit l'ordre ou le découpage.
  const vary = (res.headers.get('vary') ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
  return { status: res.status, body, headers: { ...headers, vary } };
}

describe('Parité HTTP Nest / Hono (socle transverse)', () => {
  let nest: E2eApi;
  let hono: E2eApi;
  const env = { HEALTH_TOKEN, CORS_ORIGIN: FRONT };

  beforeAll(async () => {
    [nest, hono] = await Promise.all([
      startApi({ cmd: NEST, env }),
      startApi({ cmd: HONO, env }),
    ]);
  });
  afterAll(async () => {
    await Promise.all([nest?.stop(), hono?.stop()]);
  });

  const CASES: [string, string, RequestInit?][] = [
    ['sonde de vie', '/health'],
    ['sonde de vie, origine front', '/health', { headers: { Origin: FRONT } }],
    [
      'sonde de vie, origine étrangère',
      '/health',
      { headers: { Origin: 'http://evil.test' } },
    ],
    ['ready sans jeton', '/health/ready'],
    [
      'ready mauvais jeton',
      '/health/ready',
      { headers: { 'x-health-token': 'x'.repeat(30) } },
    ],
    [
      'ready bon jeton',
      '/health/ready',
      { headers: { 'x-health-token': HEALTH_TOKEN } },
    ],
    ['route inconnue', '/nope?a=1'],
    [
      'preflight autorisé',
      '/health',
      {
        method: 'OPTIONS',
        headers: {
          Origin: FRONT,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-csrf-token',
        },
      },
    ],
    [
      'preflight refusé',
      '/health',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://evil.test',
          'Access-Control-Request-Method': 'POST',
        },
      },
    ],
  ];

  it.each(CASES)('%s', async (_label, path, init) => {
    const [a, b] = await Promise.all([
      snapshot(nest.url, path, init),
      snapshot(hono.url, path, init),
    ]);
    expect(b).toEqual(a);
  });

  it('améliorations voulues : corps JSON > 100 Ko → 413 (Nest : 500)', async () => {
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a'.repeat(200_000) }),
    };
    const [a, b] = await Promise.all([
      snapshot(nest.url, '/health', init),
      snapshot(hono.url, '/health', init),
    ]);
    expect(a.status).toBe(500);
    expect(b.status).toBe(413);
  });
});
