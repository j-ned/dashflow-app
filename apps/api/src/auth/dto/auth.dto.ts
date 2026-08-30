import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 12;
const email = z.string().email().max(255).toLowerCase();
const password = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`,
  );
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
export const resendSchema = z.object({ email });
export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis'),
  totpCode: z.string().length(6).optional(),
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
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: password,
  ...rewrap,
});
export const setPasswordSchema = z.object({ newPassword: password, ...rewrap });

export const totpVerifySchema = z.object({
  code: z.string().length(6, 'Code à 6 chiffres requis'),
});
export const totpDisableSchema = z.object({
  password: z.string().min(1, 'Mot de passe requis'),
});

export const setupEncryptionKeysSchema = z.object({
  salt: z.string().min(1),
  wrappedMasterKey: z.string().min(1),
  recoveryWrappedKey: z.string().min(1),
});
export const encryptionPassphraseSchema = z.object({
  passphrase: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `La passphrase doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`,
    ),
});
export const migrateEncryptionSchema = z.object({
  keyMaterial: setupEncryptionKeysSchema,
  data: z.record(
    z.string(),
    z.array(z.object({ id: z.string().uuid(), encryptedData: z.string() })),
  ),
});
export const resetWithRecoverySchema = z.object({
  email,
  code: z.string().length(6),
  newPassword: password,
  newSalt: z.string().optional(),
  newWrappedMasterKey: z.string().optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type VerifyDto = z.infer<typeof verifySchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordDto = z.infer<typeof updatePasswordSchema>;
export type SetPasswordDto = z.infer<typeof setPasswordSchema>;
export type TotpVerifyDto = z.infer<typeof totpVerifySchema>;
export type TotpDisableDto = z.infer<typeof totpDisableSchema>;
export type SetupEncryptionKeysDto = z.infer<typeof setupEncryptionKeysSchema>;
export type MigrateEncryptionDto = z.infer<typeof migrateEncryptionSchema>;
export type ResetWithRecoveryDto = z.infer<typeof resetWithRecoverySchema>;
