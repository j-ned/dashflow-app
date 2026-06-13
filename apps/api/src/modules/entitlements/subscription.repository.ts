import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { subscriptions } from '../../db/schema';

export type SubscriptionRow = typeof subscriptions.$inferSelect;

@Injectable()
export class SubscriptionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByUserId(userId: string): Promise<SubscriptionRow | null> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByStripeCustomerId(customerId: string): Promise<SubscriptionRow | null> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Upsert par `userId` (unique). Met à jour les colonnes fournies + `updatedAt`. */
  async upsertByUserId(
    userId: string,
    values: Partial<typeof subscriptions.$inferInsert>,
  ): Promise<SubscriptionRow> {
    const rows = await this.db
      .insert(subscriptions)
      .values({
        userId,
        planKey: values.planKey ?? 'solo',
        status: values.status ?? 'incomplete',
        source: values.source ?? 'stripe',
        ...values,
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }
}
