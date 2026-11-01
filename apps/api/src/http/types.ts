import type { AuthUser } from '../auth/auth-user';

/** Variables de contexte Hono posées par les middlewares. */
export type AppEnv = {
  Variables: {
    /** Adresse du client, résolue derrière le proxy (cf. middleware/client-ip). */
    clientIp: string;
    /** Présent sur les routes authentifiées (cf. middleware/auth). */
    user: AuthUser;
  };
};
