import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}
  sign(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }
  async verify(token: string): Promise<JwtPayload> {
    const p = await this.jwt.verifyAsync<Partial<JwtPayload>>(token);
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
