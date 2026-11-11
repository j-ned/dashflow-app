import jwt from 'jsonwebtoken';
import type { Env } from '../config/env.schema';

export const JWT_ISSUER = 'dashflow-api';
export const JWT_AUDIENCE = 'dashflow-web';
const JWT_EXPIRES_IN = '7d';
/**
 * Audience des preuves « premier facteur validé, second en attente ». Distincte de celle des
 * sessions : une preuve ne peut pas servir de cookie de session, ni l'inverse.
 */
export const MFA_PENDING_AUDIENCE = 'dashflow-mfa';
export const MFA_PENDING_TTL_SECONDS = 5 * 60;

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

/** Preuve qu'un premier facteur (Google) a été validé pour ce compte, à cette version de session. */
export interface MfaPendingPayload {
  sub: string;
  sv: number;
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
    return this.signFor(payload, JWT_AUDIENCE, JWT_EXPIRES_IN);
  }

  async verify(token: string): Promise<JwtPayload> {
    const p: Partial<JwtPayload> = await this.claimsFor(token, JWT_AUDIENCE);
    if (typeof p.sub !== 'string' || typeof p.email !== 'string') {
      throw new Error('jwt_payload_invalid');
    }
    // Token antérieur à l'introduction de `sv` : traité comme version -1 → toujours révoqué.
    const sv = typeof p.sv === 'number' ? p.sv : -1;
    return p.demo === true
      ? { sub: p.sub, email: p.email, sv, demo: true }
      : { sub: p.sub, email: p.email, sv };
  }

  signMfaPending(payload: MfaPendingPayload): Promise<string> {
    return this.signFor(payload, MFA_PENDING_AUDIENCE, MFA_PENDING_TTL_SECONDS);
  }

  async verifyMfaPending(token: string): Promise<MfaPendingPayload> {
    const p: Partial<MfaPendingPayload> = await this.claimsFor(
      token,
      MFA_PENDING_AUDIENCE,
    );
    if (typeof p.sub !== 'string' || typeof p.sv !== 'number') {
      throw new Error('jwt_payload_invalid');
    }
    return { sub: p.sub, sv: p.sv };
  }

  private signFor(
    payload: object,
    audience: string,
    expiresIn: jwt.SignOptions['expiresIn'],
  ): Promise<string> {
    return new Promise((resolve, reject) =>
      jwt.sign(
        payload,
        this.secret,
        { expiresIn, algorithm: 'HS256', issuer: JWT_ISSUER, audience },
        (err, token) =>
          token ? resolve(token) : reject(err ?? new Error('jwt_sign_failed')),
      ),
    );
  }

  /** Claims d'un jeton valide pour `audience` ; objet vide si la charge utile n'en est pas un. */
  private async claimsFor(
    token: string,
    audience: string,
  ): Promise<jwt.JwtPayload> {
    const decoded = await new Promise<string | jwt.JwtPayload | undefined>(
      (resolve, reject) =>
        jwt.verify(
          token,
          this.secret,
          { algorithms: ['HS256'], issuer: JWT_ISSUER, audience },
          (err, payload) => (err ? reject(err) : resolve(payload)),
        ),
    );
    return typeof decoded === 'object' ? decoded : {};
  }
}
