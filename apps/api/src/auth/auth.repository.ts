import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.constants';
import { totpBackupCodes, users, verificationCodes } from '../db/schema';

type User = typeof users.$inferSelect;
export type VerificationCodePurpose = 'verification' | 'reset';

/** Échecs tolérés sur un code OTP avant sa destruction (1 chance sur 200 000 sur 10 min). */
export const MAX_CODE_ATTEMPTS = 5;

/** Le code ne transite en base que hashé : un dump DB ne permet pas de valider un e-mail. */
const hashCode = (code: string): string =>
  createHash('sha256').update(code).digest('hex');

@Injectable()
export class AuthRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  findByGoogleId(googleId: string): Promise<User | undefined> {
    return this.db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1)
      .then((r) => r[0]);
  }
  findByEmail(email: string): Promise<User | undefined> {
    return this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then((r) => r[0]);
  }
  findById(id: string): Promise<User | undefined> {
    return this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .then((r) => r[0]);
  }
  findDemoAccount(): Promise<User | undefined> {
    return this.db
      .select()
      .from(users)
      .where(eq(users.isDemoAccount, true))
      .limit(1)
      .then((r) => r[0]);
  }
  async createUser(data: {
    email: string;
    password: string | null;
    displayName?: string | null;
    authVersion?: number;
  }): Promise<User> {
    const [u] = await this.db
      .insert(users)
      .values({
        email: data.email,
        password: data.password,
        displayName: data.displayName ?? null,
        authVersion: data.authVersion ?? 0,
      })
      .returning();
    return u;
  }
  async updateUser(
    id: string,
    patch: Partial<typeof users.$inferInsert>,
  ): Promise<User> {
    const [u] = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();
    return u;
  }

  /** Invalide tous les JWT émis jusqu'ici pour ce compte (le guard compare le claim `sv`). */
  async bumpSessionVersion(userId: string): Promise<User> {
    const [u] = await this.db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, userId))
      .returning();
    return u;
  }

  async insertCode(
    email: string,
    code: string,
    expiresAt: Date,
    purpose: VerificationCodePurpose,
  ): Promise<void> {
    await this.db
      .delete(verificationCodes)
      .where(
        and(
          eq(verificationCodes.email, email),
          eq(verificationCodes.purpose, purpose),
        ),
      );
    await this.db
      .insert(verificationCodes)
      .values({ email, code: hashCode(code), expiresAt, purpose });
  }

  /**
   * Vérifie un code : comparaison en temps constant sur le hash ; chaque échec incrémente
   * `attempts` et le code est détruit au `MAX_CODE_ATTEMPTS`-ième. Le brute-force distribué
   * (N adresses IP × throttle) ne dispose donc que de 5 essais par code, pas de 10 × N.
   */
  async findValidCode(
    email: string,
    code: string,
    purpose: VerificationCodePurpose,
  ): Promise<{ id: string } | undefined> {
    const row = await this.db
      .select({
        id: verificationCodes.id,
        code: verificationCodes.code,
        attempts: verificationCodes.attempts,
      })
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.email, email),
          eq(verificationCodes.purpose, purpose),
          gt(verificationCodes.expiresAt, new Date()),
        ),
      )
      .limit(1)
      .then((r) => r[0]);
    if (!row) return undefined;

    const given = Buffer.from(hashCode(code));
    const stored = Buffer.from(row.code);
    if (given.length === stored.length && timingSafeEqual(given, stored)) {
      return { id: row.id };
    }

    if (row.attempts + 1 >= MAX_CODE_ATTEMPTS) {
      await this.db
        .delete(verificationCodes)
        .where(eq(verificationCodes.id, row.id));
    } else {
      await this.db
        .update(verificationCodes)
        .set({ attempts: sql`${verificationCodes.attempts} + 1` })
        .where(eq(verificationCodes.id, row.id));
    }
    return undefined;
  }

  async deleteCodes(
    email: string,
    purpose: VerificationCodePurpose,
  ): Promise<void> {
    await this.db
      .delete(verificationCodes)
      .where(
        and(
          eq(verificationCodes.email, email),
          eq(verificationCodes.purpose, purpose),
        ),
      );
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }

  // ── Codes de secours 2FA (stockés en HMAC, cf. SecretCipherService.hmac) ──

  /** Remplace tout le jeu : les anciens codes, utilisés ou non, cessent de valoir. */
  async replaceBackupCodes(userId: string, hashes: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(totpBackupCodes)
        .where(eq(totpBackupCodes.userId, userId));
      if (hashes.length > 0) {
        await tx
          .insert(totpBackupCodes)
          .values(hashes.map((codeHash) => ({ userId, codeHash })));
      }
    });
  }

  /** Consomme le code en une seule requête : deux logins simultanés ne peuvent pas le partager. */
  async consumeBackupCode(userId: string, hash: string): Promise<boolean> {
    const rows = await this.db
      .update(totpBackupCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(totpBackupCodes.userId, userId),
          eq(totpBackupCodes.codeHash, hash),
          isNull(totpBackupCodes.usedAt),
        ),
      )
      .returning({ id: totpBackupCodes.id });
    return rows.length > 0;
  }

  async countUnusedBackupCodes(userId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(totpBackupCodes)
      .where(
        and(eq(totpBackupCodes.userId, userId), isNull(totpBackupCodes.usedAt)),
      );
    return Number(total);
  }

  async deleteBackupCodes(userId: string): Promise<void> {
    await this.db
      .delete(totpBackupCodes)
      .where(eq(totpBackupCodes.userId, userId));
  }
}
