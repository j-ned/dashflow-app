import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.constants';
import { users, verificationCodes } from '../db/schema';

type User = typeof users.$inferSelect;

@Injectable()
export class AuthRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  findByGoogleId(googleId: string): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.googleId, googleId)).limit(1).then((r) => r[0]);
  }
  findByEmail(email: string): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.email, email)).limit(1).then((r) => r[0]);
  }
  findById(id: string): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.id, id)).limit(1).then((r) => r[0]);
  }
  findDemoAccount(): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.isDemoAccount, true)).limit(1).then((r) => r[0]);
  }
  async createUser(data: { email: string; password: string | null; displayName?: string | null }): Promise<User> {
    const [u] = await this.db.insert(users).values({ email: data.email, password: data.password, displayName: data.displayName ?? null }).returning();
    return u;
  }
  async updateUser(id: string, patch: Partial<typeof users.$inferInsert>): Promise<User> {
    const [u] = await this.db.update(users).set(patch).where(eq(users.id, id)).returning();
    return u;
  }
  async insertCode(email: string, code: string, expiresAt: Date): Promise<void> {
    await this.db.delete(verificationCodes).where(eq(verificationCodes.email, email));
    await this.db.insert(verificationCodes).values({ email, code, expiresAt });
  }
  findValidCode(email: string, code: string): Promise<{ id: string } | undefined> {
    return this.db.select({ id: verificationCodes.id }).from(verificationCodes)
      .where(and(eq(verificationCodes.email, email), eq(verificationCodes.code, code), gt(verificationCodes.expiresAt, new Date())))
      .limit(1).then((r) => r[0]);
  }
  async deleteCodes(email: string): Promise<void> {
    await this.db.delete(verificationCodes).where(eq(verificationCodes.email, email));
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
