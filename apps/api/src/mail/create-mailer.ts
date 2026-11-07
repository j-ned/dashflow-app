import { deploymentTier, type Env } from '../config/env.schema';
import type { Mailer } from './mailer';
import { ConsoleMailer } from './console.mailer';
import { PreviewLogMailer } from './preview-log.mailer';
import { SmtpMailer } from './smtp.mailer';

/**
 * Preview : journal sans contenu, quel que soit MAILER. Le choix repose sur VERCEL_ENV (posé par
 * Vercel) et non sur une variable du projet : une variable SMTP héritée de la prod par erreur ne
 * peut pas faire partir de vrais emails, ni le mailer console écrire des codes dans les logs.
 */
export function createMailer(env: Env): Mailer {
  if (deploymentTier(env) === 'preview') return new PreviewLogMailer();
  return env.MAILER === 'smtp' ? new SmtpMailer(env) : new ConsoleMailer(env);
}
