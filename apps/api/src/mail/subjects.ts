/** Sujets des emails transactionnels, partagés par l'envoi SMTP et le journal de preview. */
export const MAIL_SUBJECTS = {
  verification: 'Votre code de vérification - DashFlow',
  passwordReset: 'Réinitialisation de mot de passe - DashFlow',
  accountExists: 'Vous avez déjà un compte DashFlow',
} as const;
