import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { EntitlementLimitsService } from '../entitlements/entitlement-limits.service';

type BankAccount = typeof bankAccounts.$inferSelect;

@Injectable()
export class BankAccountsService extends OwnedCrudService<BankAccount> {
  constructor(
    @Inject(DRIZZLE) private readonly database: DrizzleDB,
    private readonly limits: EntitlementLimitsService,
  ) {
    super(database, bankAccounts);
  }

  override async create(userId: string, values: Record<string, unknown>): Promise<BankAccount> {
    const [{ value: current }] = await this.database
      .select({ value: count() })
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId));
    await this.limits.assertWithinLimit(userId, 'bankAccounts', Number(current));
    return super.create(userId, values);
  }
}
