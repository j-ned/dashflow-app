import jwt from 'jsonwebtoken';
import type { Env } from '../config/env.schema';

export const JWT_ISSUER = 'dashflow-api';
export const JWT_AUDIENCE = 'dashflow-web';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  sub: string;
  email: string;
  /**
   * `users.session_version` au moment de la signature. Le guard compare à la valeur en base :
   * un logout, un reset ou un changement de mot de passe incrémente la colonne et invalide
   * tous les tokens émis avant, quelle que soit leur date d'expiration.
   */
  sv: number;
  /** Session ouverte via /auth/demo-login : droits restreints (cf. DemoAccountGuard). */
  demo?: true;
}

/**
 * Jetons de session HS256. Algorithme et audience explicites : un token signé autrement (ou
 * pour un autre service partageant le secret) est refusé. Les tokens sans iss/aud sont
 * invalides : reconnexion unique depuis l'introduction de ces claims.
 */
export class TokenService {
  private readonly secret: string;

  constructor(config: Pick<Env, 'JWT_SECRET'>) {
    this.secret = config.JWT_SECRET;
  }

  sign(payload: JwtPayload): Promise<string> {
    return new Promise((resolve, reject) =>
      jwt.sign(
        payload,
        this.secret,
        {
          expiresIn: JWT_EXPIRES_IN,
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
        (err, token) =>
          token ? resolve(token) : reject(err ?? new Error('jwt_sign_failed')),
      ),
    );
  }

  async verify(token: string): Promise<JwtPayload> {
    const decoded = await new Promise<string | jwt.JwtPayload | undefined>(
      (resolve, reject) =>
        jwt.verify(
          token,
          this.secret,
          {
            algorithms: ['HS256'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
          },
          (err, payload) => (err ? reject(err) : resolve(payload)),
        ),
    );
    const p = (
      typeof decoded === 'object' ? decoded : {}
    ) as Partial<JwtPayload>;
    if (typeof p.sub !== 'string' || typeof p.email !== 'string') {
      throw new Error('jwt_payload_invalid');
    }
    // Token antérieur à l'introduction de `sv` : traité comme version -1 → toujours révoqué.
    const sv = typeof p.sv === 'number' ? p.sv : -1;
    return p.demo === true
      ? { sub: p.sub, email: p.email, sv, demo: true }
      : { sub: p.sub, email: p.email, sv };
  }
}
