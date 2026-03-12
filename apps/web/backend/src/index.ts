import { config } from 'dotenv';
config({ path: process.env['DOTENV_PATH'] ?? '../.env' });
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from 'hono-rate-limiter';
import type { AppEnv } from './types.js';
import { authMiddleware } from '@middleware/auth';
import authRoutes from './routes/auth.routes.js';
import envelopeRoutes from './routes/envelope.routes.js';
import loanRoutes from './routes/loan.routes.js';
import patientRoutes from './routes/patient.routes.js';
import practitionerRoutes from './routes/practitioner.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import prescriptionRoutes from './routes/prescription.routes.js';
import medicationRoutes from './routes/medication.routes.js';
import reminderRoutes from './routes/reminder.routes.js';
import memberRoutes from './routes/member.routes.js';
import recurringEntryRoutes from './routes/recurring-entry.routes.js';
import bankAccountRoutes from './routes/bank-account.routes.js';
import salaryArchiveRoutes from './routes/salary-archive.routes.js';
import documentRoutes from './routes/document.routes.js';
import sharedAccessRoutes from './routes/shared-access.routes.js';
import medicalCalendarRoutes from './routes/medical-calendar.routes.js';
import oauthRoutes from './routes/oauth.routes.js';

// ── Startup validation ──
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
if ((process.env['JWT_SECRET']?.length ?? 0) < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

const app = new Hono<AppEnv>();

// ── Global middleware ──
app.use('*', logger());

// CORS — origin from env, fallback localhost for dev
const allowedOrigins = (process.env['CORS_ORIGIN'] ?? 'http://localhost:4200').split(',');
app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env['NODE_ENV'] === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Rate limiting — auth endpoints (strict)
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
  message: { error: 'Trop de tentatives, reessayez dans 15 minutes' },
});

// Rate limiting — general API (permissive)
const apiLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
  message: { error: 'Trop de requetes, reessayez dans une minute' },
});

// ── Health check ──
app.get('/health', (c) => c.json({ status: 'ok' }));

// ── Auth routes ──
// Strict rate limit on public auth endpoints (login, register, forgot-password)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify', authLimiter);
app.use('/api/auth/resend-code', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/oauth/*', authLimiter);
// Authenticated auth endpoints (/me/*) use the general API limiter
app.use('/api/auth/me/*', apiLimiter);
app.route('/api/auth', authRoutes);
app.route('/api/auth/oauth', oauthRoutes);

// ── Protected routes ──
const api = new Hono<AppEnv>();
api.use('*', authMiddleware);
api.use('*', apiLimiter);
api.route('/envelopes', envelopeRoutes);
api.route('/loans', loanRoutes);
api.route('/members', memberRoutes);
api.route('/recurring-entries', recurringEntryRoutes);
api.route('/bank-accounts', bankAccountRoutes);
api.route('/salary-archives', salaryArchiveRoutes);
api.route('/patients', patientRoutes);
api.route('/practitioners', practitionerRoutes);
api.route('/appointments', appointmentRoutes);
api.route('/prescriptions', prescriptionRoutes);
api.route('/medications', medicationRoutes);
api.route('/reminders', reminderRoutes);
api.route('/documents', documentRoutes);
api.route('/shared-access', sharedAccessRoutes);

app.route('/api', api);

// ── Public medical calendar (no auth) ──
app.route('/api/medical/calendar', medicalCalendarRoutes);

// ── Static SPA serving (production) ──
const staticRoot = process.env['STATIC_ROOT'];
if (staticRoot) {
  app.use('/*', serveStatic({ root: staticRoot }));
  app.get('*', serveStatic({ root: staticRoot, path: 'index.html' }));
}

// ── Start server ──
const port = Number(process.env['PORT'] ?? 3000);
console.log(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
