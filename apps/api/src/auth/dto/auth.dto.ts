import { z } from 'zod';

const email = z.string().email().max(255).toLowerCase();
/**
 * Tout nouveau secret de connexion est une clé d'authentification dérivée par le client
 * (PBKDF2 du mot de passe, 32 octets en hex), jamais le mot de passe : il sert aussi à dériver
 * la clé de chiffrement. Le format strict fait échouer un client resté sur l'ancien protocole
 * au lieu de lui laisser enregistrer un mot de passe brut. La robustesse du mot de passe ne
 * peut donc plus être contrôlée ici : elle l'est dans les formulaires du client.
 */
const password = z
  .string()
  .regex(
    /^[0-9a-f]{64}$/,
    "Client obsolète : rechargez l'application puis réessayez",
  );
/** Secret présenté pour vérification : clé d'authentification, ou mot de passe d'un compte pas encore migré. */
const presentedSecret = (message: string) =>
  z.string().min(1, message).max(1024);
const code = z.string().length(6, 'Code à 6 chiffres requis');
const rewrap = {
  newSalt: z.string().optional(),
  newWrappedMasterKey: z.string().optional(),
};

export const registerSchema = z.object({
  email,
  password,
  displayName: z.string().max(255).optional(),
});
export const verifySchema = z.object({ email, code });
export const preloginSchema = z.object({ email });
/** Bascule d'un compte sur la clé d'authentification, preuve du mot de passe à l'appui. */
export const upgradeAuthSchema = z.object({
  currentPassword: presentedSecret('Mot de passe actuel requis'),
  authKey: password,
});
export const resendSchema = z.object({ email });
export const loginSchema = z.object({
  email,
  password: presentedSecret('Mot de passe requis'),
  // Code TOTP à 6 chiffres, ou code de secours `xxxxx-xxxxx` (tiret et casse libres).
  totpCode: z.string().min(6).max(12).optional(),
});
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  email,
  code,
  newPassword: password,
});
export const updateProfileSchema = z.object({
  displayName: z.string().max(255).optional(),
});
export const updatePasswordSchema = z.object({
  currentPassword: presentedSecret('Mot de passe actuel requis'),
  newPassword: password,
  ...rewrap,
});
export const setPasswordSchema = z.object({ newPassword: password, ...rewrap });

export const totpVerifySchema = z.object({
  code: z.string().length(6, 'Code à 6 chiffres requis'),
});
export const totpDisableSchema = z.object({
  password: presentedSecret('Mot de passe requis'),
});
/** Régénérer les codes de secours = même exigence que désactiver : le mot de passe courant. */
export const backupCodesRegenerateSchema = totpDisableSchema;

const keyMaterial = {
  salt: z.string().min(1),
  wrappedMasterKey: z.string().min(1),
  recoveryWrappedKey: z.string().min(1),
};
/** `currentPassword` : exigé par le service dès que des clés existent déjà (remplacement). */
export const setupEncryptionKeysSchema = z.object({
  ...keyMaterial,
  currentPassword: presentedSecret('Mot de passe actuel requis').optional(),
});
export const migrateEncryptionSchema = z.object({
  keyMaterial: z.object(keyMaterial),
  data: z.record(
    z.string(),
    z.array(z.object({ id: z.string().uuid(), encryptedData: z.string() })),
  ),
});
export const resetWithRecoverySchema = z.object({
  email,
  code: z.string().length(6),
  newPassword: password,
  newSalt: z.string().min(1).optional(),
  newWrappedMasterKey: z.string().min(1).optional(),
  /** Clé de récupération perdue : repartir de zéro (données chiffrées et clés supprimées). */
  wipe: z.literal(true).optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type VerifyDto = z.infer<typeof verifySchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type UpgradeAuthDto = z.infer<typeof upgradeAuthSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordDto = z.infer<typeof updatePasswordSchema>;
export type SetPasswordDto = z.infer<typeof setPasswordSchema>;
export type TotpVerifyDto = z.infer<typeof totpVerifySchema>;
export type TotpDisableDto = z.infer<typeof totpDisableSchema>;
export type BackupCodesRegenerateDto = z.infer<
  typeof backupCodesRegenerateSchema
>;
export type SetupEncryptionKeysDto = z.infer<typeof setupEncryptionKeysSchema>;
export type MigrateEncryptionDto = z.infer<typeof migrateEncryptionSchema>;
export type ResetWithRecoveryDto = z.infer<typeof resetWithRecoverySchema>;
