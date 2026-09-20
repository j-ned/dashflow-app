import { Provider } from '@angular/core';
import { AccountTransactionGateway } from './domain/gateways/account-transaction.gateway';
import { HttpAccountTransactionGateway } from './infra/http-account-transaction.gateway';
import { EnvelopeGateway } from './domain/gateways/envelope.gateway';
import { HttpEnvelopeGateway } from './infra/http-envelope.gateway';
import { LoanGateway } from './domain/gateways/loan.gateway';
import { HttpLoanGateway } from './infra/http-loan.gateway';
import { MemberGateway } from './domain/gateways/member.gateway';
import { HttpMemberGateway } from './infra/http-member.gateway';
import { RecurringEntryGateway } from './domain/gateways/recurring-entry.gateway';
import { HttpRecurringEntryGateway } from './infra/http-recurring-entry.gateway';
import { BankAccountGateway } from './domain/gateways/bank-account.gateway';
import { HttpBankAccountGateway } from './infra/http-bank-account.gateway';
import { SalaryArchiveGateway } from './domain/gateways/salary-archive.gateway';
import { HttpSalaryArchiveGateway } from './infra/http-salary-archive.gateway';

/**
 * Câblage gateway → implémentation HTTP, fourni au niveau des routes chargées à la demande : fourni à
 * la racine, il embarquait tous les gateways (et leurs schémas) dans le bundle initial.
 */
export const BUDGET_GATEWAY_PROVIDERS: Provider[] = [
  { provide: AccountTransactionGateway, useClass: HttpAccountTransactionGateway },
  { provide: EnvelopeGateway, useClass: HttpEnvelopeGateway },
  { provide: LoanGateway, useClass: HttpLoanGateway },
  { provide: MemberGateway, useClass: HttpMemberGateway },
  { provide: RecurringEntryGateway, useClass: HttpRecurringEntryGateway },
  { provide: BankAccountGateway, useClass: HttpBankAccountGateway },
  { provide: SalaryArchiveGateway, useClass: HttpSalaryArchiveGateway },
];
