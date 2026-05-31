import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type BankAccount = typeof bankAccounts.$inferSelect;

@Injectable()
export class BankAccountsService extends OwnedCrudService<BankAccount> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, bankAccounts); }
}
