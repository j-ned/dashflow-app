export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  totpEnabled: boolean;
  hasPassword: boolean;
  /** 0 = le serveur vérifie encore le mot de passe lui-même ; 1 = la clé d'authentification dérivée. */
  authVersion: number;
  googleLinked: boolean;
  encryptionVersion: number;
  hasEncryptionPassphrase: boolean;
  isDemoAccount: boolean;
  role: 'user' | 'admin';
};
