import type { DrizzleDB } from '../../db/drizzle.constants';
import { bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type BankAccount = typeof bankAccounts.$inferSelect;

export class BankAccountsService extends OwnedCrudService<BankAccount> {
  constructor(database: DrizzleDB) {
    super(database, bankAccounts);
  }
}
