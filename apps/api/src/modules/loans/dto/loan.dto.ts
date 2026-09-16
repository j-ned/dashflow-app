import { z } from 'zod';
import {
  nonNegativeMoney as amount,
  positiveMoneyNumber,
  toCents,
} from '../../../common/money';

const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');

const LOAN_DIRECTIONS = ['lent', 'borrowed'] as const;

export const createLoanSchema = z
  .object({
    memberId: optionalUuid,
    person: z.string().min(1).max(255),
    direction: z.enum(LOAN_DIRECTIONS),
    amount,
    remaining: amount,
    description: z.string().max(1000).nullable().optional(),
    date: dateStr,
    dueDate: dateStr.nullable().optional(),
    dueDay: z.number().int().min(1).max(31).nullable().optional(),
  })
  .refine((d) => toCents(d.remaining) <= toCents(d.amount), {
    message: 'Le restant dû ne peut pas dépasser le montant du prêt',
    path: ['remaining'],
  })
  .refine((d) => !d.dueDate || d.dueDate >= d.date, {
    message: "L'échéance ne peut pas précéder la date du prêt",
    path: ['dueDate'],
  });

export const createEncryptedLoanSchema = z.object({
  memberId: optionalUuid,
  direction: z.enum(LOAN_DIRECTIONS).optional(),
  encryptedData: z.string().min(1),
});

export const loanTransactionSchema = z.object({
  amount: positiveMoneyNumber,
  date: dateStr,
});

export const loanPaymentSchema = z.object({
  amount: positiveMoneyNumber,
  date: dateStr.optional(),
  note: z.string().max(255).nullable().optional(),
});

export const updateLoanSchema = z
  .object({
    memberId: optionalUuid,
    person: z.string().min(1).max(255).optional(),
    direction: z.enum(LOAN_DIRECTIONS).optional(),
    amount: amount.optional(),
    remaining: amount.optional(),
    description: z.string().max(1000).nullable().optional(),
    date: dateStr.optional(),
    dueDate: dateStr.nullable().optional(),
    dueDay: z.number().int().min(1).max(31).nullable().optional(),
  })
  .refine(
    (d) =>
      d.amount === undefined ||
      d.remaining === undefined ||
      toCents(d.remaining) <= toCents(d.amount),
    {
      message: 'Le restant dû ne peut pas dépasser le montant du prêt',
      path: ['remaining'],
    },
  );

export const updateEncryptedLoanSchema = z.object({
  memberId: optionalUuid,
  direction: z.enum(LOAN_DIRECTIONS).optional(),
  encryptedData: z.string().min(1),
});
