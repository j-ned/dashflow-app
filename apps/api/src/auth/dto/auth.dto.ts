import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 12;
const email = z.string().email().max(255).toLowerCase();
const password = z.string().min(MIN_PASSWORD_LENGTH, `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`);
const code = z.string().length(6, 'Code à 6 chiffres requis');
const rewrap = { newSalt: z.string().optional(), newWrappedMasterKey: z.string().optional() };

export const registerSchema = z.object({ email, password, displayName: z.string().max(255).optional() });
export const verifySchema = z.object({ email, code });
export const resendSchema = z.object({ email });
export const loginSchema = z.object({ email, password: z.string().min(1, 'Mot de passe requis') });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ email, code, newPassword: password, ...rewrap });
export const updateProfileSchema = z.object({ displayName: z.string().max(255).optional() });
export const updatePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Mot de passe actuel requis'), newPassword: password, ...rewrap });
export const setPasswordSchema = z.object({ newPassword: password, ...rewrap });

export type RegisterDto = z.infer<typeof registerSchema>;
export type VerifyDto = z.infer<typeof verifySchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordDto = z.infer<typeof updatePasswordSchema>;
export type SetPasswordDto = z.infer<typeof setPasswordSchema>;
