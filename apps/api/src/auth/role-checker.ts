import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '../db/drizzle.constants';
import { users } from '../db/schema';
import { ForbiddenError, UnauthorizedError } from '../common/errors';

export type UserRole = 'user' | 'admin';

/** Rôle relu en base à chaque requête : une rétrogradation s'applique sans attendre le JWT. */
export class RoleChecker {
  constructor(private readonly db: DrizzleDB) {}

  async assert(
    userId: string | undefined,
    required: readonly UserRole[],
  ): Promise<void> {
    if (required.length === 0) return;
    if (!userId) throw new UnauthorizedError('Non authentifié');
    const rows = await this.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const role = rows[0]?.role as UserRole | undefined;
    if (!role || !required.includes(role))
      throw new ForbiddenError('Accès réservé');
  }
}
