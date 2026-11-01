import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { RoleChecker } from '../../auth/role-checker';
import { ROLES_KEY, type UserRole } from '../decorators/roles.decorator';

/** Adaptateur Nest de RoleChecker : rôles requis lus sur `@Roles(...)`. */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly roles: RoleChecker;

  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) db: DrizzleDB,
  ) {
    this.roles = new RoleChecker(db);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    await this.roles.assert(req.user?.id, required);
    return true;
  }
}
