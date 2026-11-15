/** Sujets des emails transactionnels, partagés par les mailers (SMTP, Resend). */
export const MAIL_SUBJECTS = {
  verification: 'Votre code de vérification - DashFlow',
  passwordReset: 'Réinitialisation de mot de passe - DashFlow',
  accountExists: 'Vous avez déjà un compte DashFlow',
} as const;
