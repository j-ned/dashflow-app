import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Google, generateState, generateCodeVerifier } from 'arctic';
import { db } from '@db/client';
import { users } from '@db/schema';
import { signToken } from '@middleware/auth';
import type { AppEnv } from '../types.js';

// ── Lazy-init Google OAuth ──

let _google: Google | null = null;
function getGoogle(): Google {
  if (!_google) {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
    const redirectUri = `${process.env['APP_URL'] ?? 'http://localhost:3000'}/api/auth/oauth/google/callback`;
    if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required');
    _google = new Google(clientId, clientSecret, redirectUri);
  }
  return _google;
}

// Store pending OAuth states (in-memory, fine for single-instance)
const pendingStates = new Map<string, { codeVerifier: string; expiresAt: number }>();

// Cleanup expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
}, 60_000);

const oauth = new Hono<AppEnv>();

// ── Google OAuth ──

oauth.get('/google', async (c) => {
  try {
    const google = getGoogle();
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    pendingStates.set(state, { codeVerifier, expiresAt: Date.now() + 10 * 60_000 });

    const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);
    return c.redirect(url.toString());
  } catch {
    return c.json({ error: 'Google OAuth non configure' }, 500);
  }
});

oauth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const frontendUrl = process.env['CORS_ORIGIN'] ?? 'http://localhost:4200';

  if (!code || !state) {
    return c.redirect(`${frontendUrl}/auth/login?error=oauth_failed`);
  }

  const pending = pendingStates.get(state);
  if (!pending) {
    return c.redirect(`${frontendUrl}/auth/login?error=oauth_expired`);
  }
  pendingStates.delete(state);

  try {
    const google = getGoogle();
    const tokens = await google.validateAuthorizationCode(code, pending.codeVerifier);
    const accessToken = tokens.accessToken();

    // Fetch Google user info
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await res.json() as { id: string; email: string; name?: string; picture?: string };

    if (!profile.email) {
      return c.redirect(`${frontendUrl}/auth/login?error=oauth_no_email`);
    }

    // Find or create user
    const { token, user } = await findOrCreateGoogleUser({
      googleId: profile.id,
      email: profile.email,
      displayName: profile.name ?? profile.email.split('@')[0],
      avatarUrl: profile.picture ?? null,
    });

    return c.redirect(`${frontendUrl}/auth/login?token=${token}&userId=${user.id}`);
  } catch (err) {
    console.error('[OAuth] Google callback error:', err);
    return c.redirect(`${frontendUrl}/auth/login?error=oauth_failed`);
  }
});

// ── Find or create Google user ──

type GoogleProfile = {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

async function findOrCreateGoogleUser(profile: GoogleProfile) {
  // 1. Try find by Google ID
  const [byGoogle] = await db.select().from(users)
    .where(eq(users.googleId, profile.googleId))
    .limit(1);

  if (byGoogle) {
    const token = await signToken({ sub: byGoogle.id, email: byGoogle.email });
    return { token, user: byGoogle };
  }

  // 2. Try find by email (link accounts)
  const [byEmail] = await db.select().from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (byEmail) {
    const [updated] = await db.update(users)
      .set({ googleId: profile.googleId, emailVerified: byEmail.emailVerified ?? new Date() })
      .where(eq(users.id, byEmail.id))
      .returning();
    const token = await signToken({ sub: updated.id, email: updated.email });
    return { token, user: updated };
  }

  // 3. Create new user (no password, email auto-verified)
  const [newUser] = await db.insert(users).values({
    email: profile.email,
    displayName: profile.displayName,
    googleId: profile.googleId,
    emailVerified: new Date(),
  }).returning();

  const token = await signToken({ sub: newUser.id, email: newUser.email });
  return { token, user: newUser };
}

export default oauth;
