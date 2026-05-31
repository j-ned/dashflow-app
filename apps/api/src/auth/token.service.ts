import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload { sub: string; email: string }

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}
  sign(payload: JwtPayload): Promise<string> { return this.jwt.signAsync(payload); }
  async verify(token: string): Promise<JwtPayload> {
    const p = await this.jwt.verifyAsync<JwtPayload>(token);
    return { sub: p.sub, email: p.email };
  }
}
