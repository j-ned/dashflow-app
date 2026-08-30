export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  totpEnabled: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  encryptionVersion: number;
  hasEncryptionPassphrase: boolean;
  isDemoAccount: boolean;
  role: 'user' | 'admin';
};
