import { jwtVerify } from 'jose';
import type { Context, Next } from 'hono';
import type { AppEnv } from '../types.js';

export type AuthPayload = {
  sub: string;
  email: string;
};

// Lazy-init: dotenv runs in index.ts before any route handler,
// but this module may be imported before dotenv runs.
let _cachedKey: Uint8Array | null = null;
function getJwtKey(): Uint8Array {
  if (!_cachedKey) {
    const secret = process.env['JWT_SECRET'];
    if (!secret) throw new Error('JWT_SECRET is required');
    _cachedKey = new TextEncoder().encode(secret);
  }
  return _cachedKey;
}

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('Authorization');
  const queryToken = c.req.query('token');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;

  if (!token) {
    return c.json({ error: 'Token manquant' }, 401);
  }
  try {
    const { payload } = await jwtVerify(token, getJwtKey());
    c.set('userId', payload.sub as string);
    c.set('email', payload.email as string);
    await next();
  } catch {
    return c.json({ error: 'Token invalide' }, 401);
  }
}

export async function signToken(payload: AuthPayload): Promise<string> {
  const { SignJWT } = await import('jose');
  return new SignJWT({ email: payload.email })
    .setSubject(payload.sub)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtKey());
}
