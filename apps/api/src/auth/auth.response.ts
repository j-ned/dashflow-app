import type { users } from '../db/schema';
type User = typeof users.$inferSelect;

export function toPublicUser(u: User) {
  return {
    id: u.id, email: u.email, displayName: u.displayName,
    avatarUrl: u.avatarUrl ? `/auth/avatar/${u.id}` : null,
    totpEnabled: !!u.totpEnabled, hasPassword: !!u.password, googleLinked: !!u.googleId,
    encryptionVersion: u.encryptionVersion, hasEncryptionPassphrase: u.encryptionPassphrase,
    isDemoAccount: u.isDemoAccount,
  };
}
export function toKeyMaterial(u: User) {
  if (!u.encryptionSalt || !u.wrappedMasterKey) return null;
  return { salt: u.encryptionSalt, wrappedMasterKey: u.wrappedMasterKey, recoveryWrappedKey: u.recoveryWrappedKey };
}
