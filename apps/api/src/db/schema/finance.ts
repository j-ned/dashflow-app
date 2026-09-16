import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  date,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { patients } from './medical';

export const ENVELOPE_TYPES = [
  'épargne',
  'impôts',
  'équipement',
  'vacances',
] as const;
export const envelopeTypeEnum = pgEnum('envelope_type', ENVELOPE_TYPES);

export const loanDirectionEnum = pgEnum('loan_direction', ['lent', 'borrowed']);

export const bankAccountTypeEnum = pgEnum('bank_account_type', [
  'courant',
  'épargne',
  'carte',
  'espèces',
]);

export const transactionDirectionEnum = pgEnum('transaction_direction', [
  'income',
  'expense',
  'transfer',
]);

export const recurringEntryTypeEnum = pgEnum('recurring_entry_type', [
  'income',
  'expense',
  'annual_expense',
  'spending',
  'transfer',
]);

export const consumableCategoryEnum = pgEnum('consumable_category', [
  'ink',
  'toner',
  'paper',
  'other',
]);

export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: bankAccountTypeEnum('type').notNull().default('courant'),
    initialBalance: numeric('initial_balance', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    color: varchar('color', { length: 7 }),
    dotColor: varchar('dot_color', { length: 7 }),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('bank_accounts_user_created_idx').on(t.userId, t.createdAt, t.id),
  ],
);

export const accountTransactions = pgTable(
  'account_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    direction: transactionDirectionEnum('direction')
      .notNull()
      .default('expense'),
    toAccountId: uuid('to_account_id').references(() => bankAccounts.id, {
      onDelete: 'set null',
    }),
    date: date('date').notNull(),
    category: varchar('category', { length: 100 }),
    note: varchar('note', { length: 255 }),
    memberId: uuid('member_id').references(() => patients.id, {
      onDelete: 'set null',
    }),
    recurringEntryId: uuid('recurring_entry_id').references(
      () => recurringEntries.id,
      { onDelete: 'set null' },
    ),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('account_transactions_amount_nonneg', sql`${t.amount} >= 0`),
    index('account_transactions_user_created_idx').on(
      t.userId,
      t.createdAt,
      t.id,
    ),
    index('account_transactions_account_created_idx').on(
      t.accountId,
      t.createdAt,
      t.id,
    ),
    index('account_transactions_to_account_idx').on(t.toAccountId),
    index('account_transactions_member_idx').on(t.memberId),
    index('account_transactions_recurring_idx').on(t.recurringEntryId),
    check(
      'account_transactions_no_self_transfer',
      sql`${t.toAccountId} is null or ${t.toAccountId} <> ${t.accountId}`,
    ),
  ],
);

export const envelopes = pgTable(
  'envelopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').references(() => patients.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    type: envelopeTypeEnum('type').notNull(),
    balance: numeric('balance', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    target: numeric('target', { precision: 12, scale: 2 }),
    color: varchar('color', { length: 7 }),
    dueDay: integer('due_day'),
    encryptedData: text('encrypted_data'),
  },
  (t) => [
    check(
      'envelopes_target_nonneg',
      sql`${t.target} is null or ${t.target} >= 0`,
    ),
    index('envelopes_user_idx').on(t.userId),
    index('envelopes_member_idx').on(t.memberId),
    check(
      'envelopes_due_day_range',
      sql`${t.dueDay} is null or (${t.dueDay} between 1 and 31)`,
    ),
  ],
);

export const envelopeTransactions = pgTable(
  'envelope_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    envelopeId: uuid('envelope_id')
      .notNull()
      .references(() => envelopes.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    date: date('date').notNull(),
    note: varchar('note', { length: 255 }),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('envelope_transactions_envelope_created_idx').on(
      t.envelopeId,
      t.createdAt,
      t.id,
    ),
  ],
);

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').references(() => patients.id, {
      onDelete: 'set null',
    }),
    person: varchar('person', { length: 255 }).notNull(),
    direction: loanDirectionEnum('direction').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    remaining: numeric('remaining', { precision: 12, scale: 2 }).notNull(),
    description: text('description'),
    date: date('date').notNull(),
    dueDate: date('due_date'),
    dueDay: integer('due_day'),
    encryptedData: text('encrypted_data'),
  },
  (t) => [
    check('loans_amount_nonneg', sql`${t.amount} >= 0`),
    check('loans_remaining_nonneg', sql`${t.remaining} >= 0`),
    check('loans_remaining_lte_amount', sql`${t.remaining} <= ${t.amount}`),
    index('loans_user_idx').on(t.userId),
    index('loans_member_idx').on(t.memberId),
    check(
      'loans_due_day_range',
      sql`${t.dueDay} is null or (${t.dueDay} between 1 and 31)`,
    ),
    check(
      'loans_due_date_after_date',
      sql`${t.dueDate} is null or ${t.dueDate} >= ${t.date}`,
    ),
  ],
);

export const loanTransactions = pgTable(
  'loan_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    date: date('date').notNull(),
    note: varchar('note', { length: 255 }),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('loan_transactions_amount_nonneg', sql`${t.amount} >= 0`),
    index('loan_transactions_loan_created_idx').on(t.loanId, t.createdAt, t.id),
  ],
);

export const consumables = pgTable(
  'consumables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').references(() => patients.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    category: consumableCategoryEnum('category').notNull(),
    quantity: integer('quantity').notNull().default(0),
    minThreshold: integer('min_threshold').notNull().default(0),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    lastRestocked: timestamp('last_restocked', { withTimezone: true }),
    installedAt: timestamp('installed_at', { withTimezone: true }),
    estimatedLifetimeDays: integer('estimated_lifetime_days'),
  },
  (t) => [
    index('consumables_user_idx').on(t.userId),
    index('consumables_member_idx').on(t.memberId),
  ],
);

export const recurringEntries = pgTable(
  'recurring_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').references(() => patients.id, {
      onDelete: 'set null',
    }),
    accountId: uuid('account_id').references(() => bankAccounts.id, {
      onDelete: 'set null',
    }),
    label: varchar('label', { length: 255 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    type: recurringEntryTypeEnum('type').notNull(),
    dayOfMonth: integer('day_of_month'),
    date: date('date'),
    endDate: date('end_date'),
    toAccountId: uuid('to_account_id').references(() => bankAccounts.id, {
      onDelete: 'set null',
    }),
    category: varchar('category', { length: 100 }),
    payslipKey: text('payslip_key'),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('recurring_entries_amount_nonneg', sql`${t.amount} >= 0`),
    index('recurring_entries_user_created_idx').on(t.userId, t.createdAt, t.id),
    index('recurring_entries_member_idx').on(t.memberId),
    index('recurring_entries_account_idx').on(t.accountId),
    index('recurring_entries_to_account_idx').on(t.toAccountId),
    check(
      'recurring_entries_day_of_month_range',
      sql`${t.dayOfMonth} is null or (${t.dayOfMonth} between 1 and 31)`,
    ),
    check(
      'recurring_entries_end_after_start',
      sql`${t.endDate} is null or ${t.date} is null or ${t.endDate} >= ${t.date}`,
    ),
    check(
      'recurring_entries_no_self_transfer',
      sql`${t.toAccountId} is null or ${t.accountId} is null or ${t.toAccountId} <> ${t.accountId}`,
    ),
  ],
);

export const salaryArchives = pgTable(
  'salary_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').references(() => bankAccounts.id, {
      onDelete: 'set null',
    }),
    month: varchar('month', { length: 7 }).notNull(),
    salary: numeric('salary', { precision: 12, scale: 2 }).notNull(),
    totalExpenses: numeric('total_expenses', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    totalSpendings: numeric('total_spendings', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    spendings: jsonb('spendings').notNull().default([]),
    payslipKey: text('payslip_key'),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('salary_archives_salary_nonneg', sql`${t.salary} >= 0`),
    check(
      'salary_archives_total_expenses_nonneg',
      sql`${t.totalExpenses} >= 0`,
    ),
    check(
      'salary_archives_total_spendings_nonneg',
      sql`${t.totalSpendings} >= 0`,
    ),
    index('salary_archives_user_month_idx').on(t.userId, t.month, t.id),
    index('salary_archives_account_idx').on(t.accountId),
  ],
);
