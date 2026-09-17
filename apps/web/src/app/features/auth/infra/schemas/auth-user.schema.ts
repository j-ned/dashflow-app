import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { AuthUser } from '../../domain/models/auth-user.model';

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.nullable(z.string()),
  avatarUrl: z.nullable(z.string()),
  totpEnabled: z.boolean(),
  hasPassword: z.boolean(),
  authVersion: z.number(),
  googleLinked: z.boolean(),
  encryptionVersion: z.number(),
  hasEncryptionPassphrase: z.boolean(),
  isDemoAccount: z.boolean(),
  role: z.enum(['user', 'admin']),
});

// Garde-fou anti-dérive : si AuthUser évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof AuthUserSchema>, AuthUser>>;
