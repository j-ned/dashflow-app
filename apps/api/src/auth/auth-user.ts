/** Utilisateur authentifié attaché à la requête par la couche HTTP (guard Nest ou middleware). */
export interface AuthUser {
  id: string;
  email: string;
  /** `users.session_version` porté par le JWT : lie le jeton CSRF à la session. */
  sessionVersion: number;
  /** Vrai pour une session démo anonyme (claim `demo` du JWT). */
  isDemo?: boolean;
}
