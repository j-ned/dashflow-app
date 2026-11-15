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
  MAILER: z.enum(['console', 'smtp', 'resend']).default('console'),
  // ── Resend (mailer = resend) : clé d'API et expéditeur sur un domaine vérifié chez Resend ──
  RESEND_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().optional(),
  ),
  MAIL_FROM: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().optional(),
  ),
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
  // Redis (service de Dokploy) : compteurs de throttling partagés entre les instances de l'API.
  // Absent → compteurs en mémoire, propres à chaque processus.
  REDIS_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .url()
      .refine((v) => /^rediss?:\/\//.test(v), {
        message: 'REDIS_URL : une adresse redis:// ou rediss:// attendue',
      })
      .optional(),
  ),
  // En-tête portant l'adresse du visiteur, posé par un tunnel (Cloudflare : cf-connecting-ip).
  // À ne régler que si rien d'autre que ce tunnel ne joint le serveur : sinon un client choisirait
  // lui-même l'adresse comptée par le throttling (cf. http/middleware/client-ip.ts).
  CLIENT_IP_HEADER: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .regex(
        /^[a-z0-9-]+$/,
        'CLIENT_IP_HEADER : un nom d’en-tête en minuscules',
      )
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
});

/** Production (NODE_ENV=production) : servie en HTTPS, cookies Secure/__Host- et en-tête Origin exigé. */
export const servesOverHttps = (
  env: Pick<z.infer<typeof envBaseSchema>, 'NODE_ENV'>,
): boolean => env.NODE_ENV === 'production';

const EXAMPLE_JWT_SECRET = /^dev-secret|change-me|^x+$/i;

// Garde-fous production : le mailer « console » écrit les codes OTP dans stdout (logs Dokploy),
// et le secret JWT d'exemple du .env.example ne doit jamais signer une session réelle.
export const envSchema = envBaseSchema.superRefine((env, ctx) => {
  if (!servesOverHttps(env)) return;
  if (EXAMPLE_JWT_SECRET.test(env.JWT_SECRET)) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_SECRET'],
      message:
        'JWT_SECRET ressemble à une valeur d’exemple : générez un secret aléatoire',
    });
  }
  if (env.MAILER === 'resend') {
    for (const key of ['RESEND_API_KEY', 'MAIL_FROM'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `MAILER=resend : ${key} est requis`,
        });
      }
    }
  } else if (env.MAILER !== 'smtp' || !env.SMTP_HOST) {
    ctx.addIssue({
      code: 'custom',
      path: ['MAILER'],
      message:
        'En production, MAILER doit valoir "resend" ou "smtp" (avec SMTP_HOST défini)',
    });
  }
});

export type Env = z.infer<typeof envBaseSchema>;

export const ENV_KEYS = Object.keys(envBaseSchema.shape) as (keyof Env)[];
