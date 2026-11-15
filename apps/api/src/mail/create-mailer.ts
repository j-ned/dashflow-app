import type { Env } from '../config/env.schema';
import type { Mailer } from './mailer';
import { ConsoleMailer } from './console.mailer';
import { ResendMailer } from './resend.mailer';
import { SmtpMailer } from './smtp.mailer';

export function createMailer(env: Env): Mailer {
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
