import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email: string;
  /** `users.session_version` porté par le JWT : lie le jeton CSRF à la session. */
  sessionVersion: number;
  /** Vrai pour une session démo anonyme (claim `demo` du JWT). */
  isDemo?: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
