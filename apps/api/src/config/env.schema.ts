import { z } from 'zod';

const envBaseSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET doit faire au moins 32 caractères'),
  MAILER: z.enum(['console', 'smtp']).default('console'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3001'),
  // Observabilité Sentry (backend). Vide/absent → Sentry inactif (cf. src/instrument.ts qui lit
  // process.env directement). Fourni en prod via l'env Dokploy. Chaîne vide tolérée.
  SENTRY_DSN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  // Active le compte démo public (login sans mot de passe + reset). À couper en prod si non souhaité.
  DEMO_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  // chaîne vide tolérée (= non configuré) pour laisser la clé présente mais vide dans .env
  S3_ENDPOINT: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  // ── SMTP (mailer = smtp) ──
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('DashFlow <noreply@dashflow.app>'),
});

// Garde-fous production : le mailer « console » écrit les codes OTP dans stdout (logs Dokploy),
// et le secret JWT d'exemple du .env.example ne doit jamais signer une session réelle.
export const envSchema = envBaseSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  if (env.MAILER !== 'smtp' || !env.SMTP_HOST) {
    ctx.addIssue({
      code: 'custom',
      path: ['MAILER'],
      message: 'En production, MAILER doit valoir "smtp" avec SMTP_HOST défini',
    });
  }
  if (/^dev-secret|change-me|^x+$/i.test(env.JWT_SECRET)) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_SECRET'],
      message:
        'JWT_SECRET ressemble à une valeur d’exemple : générez un secret aléatoire',
    });
  }
});

export type Env = z.infer<typeof envBaseSchema>;
