import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';

export type { AuthUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
