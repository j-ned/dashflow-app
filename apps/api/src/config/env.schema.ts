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
  // Clé AES-256 (32 octets, hex ou base64) chiffrant les secrets TOTP au repos et signant les
  // codes de secours. Absente → dérivée de JWT_SECRET (cf. SecretCipherService).
  TOTP_ENC_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(43).optional(),
  ),
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
  // Jeton de GET /health/ready (état de la base, pour un monitoring externe). Absent → la route
  // répond 404. Chaîne vide tolérée.
  HEALTH_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .min(24, 'HEALTH_TOKEN doit faire au moins 24 caractères')
      .optional(),
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
  // ── Vercel ──
  // Posé par la plateforme ('1') : l'API tourne en fonctions, plusieurs instances en parallèle.
  VERCEL: z.string().optional(),
  // Jeton des tâches planifiées (Vercel Cron l'envoie en `Authorization: Bearer …`). Absent → les
  // routes /cron/* répondent 404.
  CRON_SECRET: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .min(16, 'CRON_SECRET doit faire au moins 16 caractères')
      .optional(),
  ),
  // Redis REST (Upstash) pour le throttling partagé entre instances. Noms posés par
  // l'intégration Vercel (KV_REST_API_*) ou par Upstash directement (UPSTASH_REDIS_REST_*).
  KV_REST_API_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  KV_REST_API_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

/** Redis REST configuré, quel que soit le nom des variables. */
export function redisRestConfig(
  env: Pick<
    z.infer<typeof envBaseSchema>,
    | 'KV_REST_API_URL'
    | 'KV_REST_API_TOKEN'
    | 'UPSTASH_REDIS_REST_URL'
    | 'UPSTASH_REDIS_REST_TOKEN'
  >,
): { url: string; token: string } | undefined {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : undefined;
}

// Garde-fous production : le mailer « console » écrit les codes OTP dans stdout (logs Dokploy),
// et le secret JWT d'exemple du .env.example ne doit jamais signer une session réelle.
export const envSchema = envBaseSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  // Sur Vercel, des compteurs en mémoire seraient propres à chaque instance : le throttling
  // anti-brute-force serait contournable. Et sans CRON_SECRET, aucune tâche de fond ne tourne.
  if (env.VERCEL === '1') {
    if (!redisRestConfig(env)) {
      ctx.addIssue({
        code: 'custom',
        path: ['KV_REST_API_URL'],
        message:
          'Sur Vercel, un Redis REST (Upstash) est requis pour le throttling',
      });
    }
    if (!env.CRON_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['CRON_SECRET'],
        message:
          'Sur Vercel, CRON_SECRET est requis pour les tâches planifiées',
      });
    }
  }
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

export const ENV_KEYS = Object.keys(envBaseSchema.shape) as (keyof Env)[];
