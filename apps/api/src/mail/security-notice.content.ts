import type { NoticeReason } from '../modules/admin/account-security';

export type SecurityNoticeContent = {
  subject: string;
  /** Phrase d'accroche, sous le titre. */
  intro: string;
  /** Étapes à suivre, dans l'ordre. */
  steps: string[];
  /** Libellé et chemin du bouton, relatif au site (pas à l'API). */
  cta: { label: string; path: string };
};

/**
 * Textes des relances de sécurité. Fixes et versionnés ici : l'administration choisit un motif,
 * jamais le contenu — un compte admin compromis ne peut pas s'en servir pour du hameçonnage.
 */
export const SECURITY_NOTICE_CONTENT: Record<
  NoticeReason,
  SecurityNoticeContent
> = {
  reconnect: {
    subject:
      'Reconnectez-vous pour finaliser une mise à jour de sécurité - DashFlow',
    intro:
      "Nous avons renforcé la connexion à DashFlow : votre mot de passe ne quitte plus votre appareil. Pour en bénéficier, votre compte doit se reconnecter une fois. Nous avons donc fermé vos sessions ouvertes : c'est normal si DashFlow vous redemande votre mot de passe.",
    steps: [
      'Ouvrez DashFlow et connectez-vous avec votre mot de passe habituel : la mise à jour se fait toute seule.',
      'Allez dans Paramètres → Chiffrement, puis « Vérifier ma clé » pour contrôler votre clé de récupération.',
      'Si vous utilisez la double authentification, régénérez vos codes de secours dans Paramètres → Authentification à deux facteurs.',
    ],
    cta: { label: 'Me connecter', path: '/auth/login' },
  },
  enable_encryption: {
    subject: 'Protégez vos données DashFlow : il reste une étape',
    intro:
      "Votre compte n'a pas encore activé le chiffrement de bout en bout. Tant que ce n'est pas fait, vos données ne sont pas protégées comme elles devraient l'être.",
    steps: [
      'Connectez-vous à DashFlow.',
      "Suivez l'écran « Protégez vos données » : cela prend moins d'une minute.",
      'Notez la clé de récupération affichée à la fin et rangez-la en lieu sûr : elle ne sera plus montrée.',
    ],
    cta: { label: 'Activer la protection', path: '/auth/login' },
  },
  recovery_key: {
    subject: "Votre compte DashFlow n'a pas de clé de récupération",
    intro:
      "Vos données sont chiffrées, mais aucune clé de récupération n'est enregistrée pour votre compte. Si vous oubliez votre mot de passe, vos données seront définitivement perdues.",
    steps: [
      'Connectez-vous à DashFlow.',
      'Allez dans Paramètres → Chiffrement → « Régénérer la clé de récupération ».',
      'Notez la clé affichée et rangez-la en lieu sûr, hors de DashFlow.',
    ],
    cta: { label: 'Générer ma clé', path: '/auth/login' },
  },
  enable_2fa: {
    subject: 'Ajoutez une seconde protection à votre compte DashFlow',
    intro:
      "Votre compte est protégé par votre seul mot de passe. La double authentification ajoute un code à usage unique : même si votre mot de passe fuit, personne d'autre ne peut se connecter.",
    steps: [
      "Installez une application d'authentification (Aegis, 2FAS, Google Authenticator…).",
      'Dans DashFlow, allez dans Paramètres → Authentification à deux facteurs → « Configurer la 2FA ».',
      'Conservez les codes de secours affichés à la fin.',
    ],
    cta: { label: 'Configurer la 2FA', path: '/auth/login' },
  },
};

export const SECURITY_NOTICE_FOOTER =
  "Ce message vous est envoyé par l'administrateur de votre espace DashFlow. DashFlow ne vous demandera jamais votre mot de passe ni votre clé de récupération par e-mail.";

export function securityNoticeText(
  content: SecurityNoticeContent,
  webUrl: string,
): string {
  const steps = content.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return `${content.intro}\n\n${steps}\n\n${content.cta.label} : ${webUrl}${content.cta.path}\n\n${SECURITY_NOTICE_FOOTER}`;
}
