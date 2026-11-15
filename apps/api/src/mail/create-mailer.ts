import { deploymentTier, type Env } from '../config/env.schema';
import type { Mailer } from './mailer';
import { ConsoleMailer } from './console.mailer';
import { PreviewLogMailer } from './preview-log.mailer';
import { ResendMailer } from './resend.mailer';
import { SmtpMailer } from './smtp.mailer';

/**
 * Preview : journal sans contenu, quel que soit MAILER. Le choix repose sur VERCEL_ENV (posé par
 * Vercel) et non sur une variable du projet : une variable SMTP héritée de la prod par erreur ne
 * peut pas faire partir de vrais emails, ni le mailer console écrire des codes dans les logs.
 */
export function createMailer(env: Env): Mailer {
  if (deploymentTier(env) === 'preview') return new PreviewLogMailer();
  switch (env.MAILER) {
    case 'smtp':
      return new SmtpMailer(env);
    case 'resend':
      return new ResendMailer(resendConfig(env));
    case 'console':
      return new ConsoleMailer(env);
    default:
      return assertNever(env.MAILER);
  }
}

/** Clé et expéditeur sont exigés par envSchema quand MAILER=resend : leur absence ici est un bug. */
function resendConfig(env: Env) {
  const { RESEND_API_KEY, MAIL_FROM, CORS_ORIGIN } = env;
  if (!RESEND_API_KEY || !MAIL_FROM)
    throw new Error('MAILER=resend exige RESEND_API_KEY et MAIL_FROM');
  return { RESEND_API_KEY, MAIL_FROM, CORS_ORIGIN };
}

function assertNever(value: never): never {
  throw new Error(`MAILER inattendu : ${String(value)}`);
}
