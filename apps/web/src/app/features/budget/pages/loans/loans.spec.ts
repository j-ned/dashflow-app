import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { LoanGateway } from '../../domain/gateways/loan.gateway';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Loan } from '../../domain/models/loan.model';
import { Loans } from './loans';

const LENT: Loan = {
  id: 'l1',
  memberId: 'm1',
  person: 'Alice',
  direction: 'lent',
  amount: 1000,
  remaining: 600,
  description: '',
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
};
const BORROWED: Loan = { ...LENT, id: 'l2', person: 'Bob', direction: 'borrowed', remaining: 200 };
const NEW_LENT: Omit<Loan, 'id'> = { ...LENT } as Omit<Loan, 'id'>;
const NEW_BORROWED: Omit<Loan, 'id'> = { ...BORROWED } as Omit<Loan, 'id'>;

type Cmp = {
  createLoan: (d: Omit<Loan, 'id'>) => Promise<void>;
  updateLoan: (d: Omit<Loan, 'id'>) => Promise<void>;
  recordPayment: (e: {
    amount: number;
    date: string;
    accountId: string | null;
    note: string | null;
  }) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  selectedLoan: { set: (v: Loan | null) => void };
  lentVMs: () => { loan: Loan }[];
  borrowedVMs: () => { loan: Loan }[];
  lentTotal: () => number;
  borrowedTotal: () => number;
  netDirection: () => 'positive' | 'negative' | 'even';
};

function make(
  opts: {
    loans?: Loan[];
    create?: ReturnType<typeof vi.fn>;
    confirmDelete?: () => Promise<boolean>;
  } = {},
) {
  const getAll = vi.fn(() => of(opts.loans ?? [LENT, BORROWED]));
  const getAllTransactions = vi.fn(() => of([]));
  const create = opts.create ?? vi.fn(() => of(LENT));
  const update = vi.fn(() => of(LENT));
  const del = vi.fn(() => of(undefined));
  const recordPaymentGw = vi.fn(() => of(LENT));
  const recurringCreate = vi.fn((_e: unknown) => of({ id: 'r1' }));
  const success = vi.fn();
  const error = vi.fn();
  const lentClose = vi.fn();
  const borrowedClose = vi.fn();
  const editClose = vi.fn();
  const paymentClose = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      {
        provide: LoanGateway,
        useValue: {
          getAll,
          getAllTransactions,
          create,
          update,
          delete: del,
          recordPayment: recordPaymentGw,
        },
      },
      { provide: MemberGateway, useValue: { getAll: () => of([]) } },
      { provide: BankAccountGateway, useValue: { getAll: () => of([]) } },
      { provide: RecurringEntryGateway, useValue: { create: recurringCreate } },
      { provide: Toaster, useValue: { success, error } },
      {
        provide: ConfirmService,
        useValue: { delete: opts.confirmDelete ?? (() => Promise.resolve(true)) },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Loans, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Loans);
  const refs = fixture.componentInstance as unknown as {
    lentModalRef: () => { open: () => void; close: () => void };
    borrowedModalRef: () => { open: () => void; close: () => void };
    editModalRef: () => { open: () => void; close: () => void };
    paymentModalRef: () => { open: () => void; close: () => void };
    historyModalRef: () => { open: () => void; close: () => void };
  };
  refs.lentModalRef = () => ({ open: vi.fn(), close: lentClose });
  refs.borrowedModalRef = () => ({ open: vi.fn(), close: borrowedClose });
  refs.editModalRef = () => ({ open: vi.fn(), close: editClose });
  refs.paymentModalRef = () => ({ open: vi.fn(), close: paymentClose });
  refs.historyModalRef = () => ({ open: vi.fn(), close: vi.fn() });
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    create,
    update,
    del,
    recordPaymentGw,
    recurringCreate,
    success,
    error,
    lentClose,
    borrowedClose,
  };
}

describe('Loans', () => {
  it('createLoan lent → ferme lentModal + toast lentCreated', async () => {
    const { cmp, create, lentClose, success } = make();
    await cmp.createLoan(NEW_LENT);
    expect(create).toHaveBeenCalledWith(NEW_LENT);
    expect(lentClose).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith('budget.loan.messages.lentCreated');
  });

  it('createLoan borrowed → ferme borrowedModal + toast borrowedCreated', async () => {
    const { cmp, borrowedClose, success } = make();
    await cmp.createLoan(NEW_BORROWED);
    expect(borrowedClose).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith('budget.loan.messages.borrowedCreated');
  });

  it('createLoan erreur → toast createError', async () => {
    const { cmp, error } = make({ create: vi.fn(() => throwError(() => new Error('boom'))) });
    await cmp.createLoan(NEW_LENT);
    expect(error).toHaveBeenCalledWith('budget.loan.messages.createError');
  });

  it('updateLoan sans sélection → no-op', async () => {
    const { cmp, update } = make();
    cmp.selectedLoan.set(null);
    await cmp.updateLoan(NEW_LENT);
    expect(update).not.toHaveBeenCalled();
  });

  it('recordPayment sur un prêt accordé avec compte → écriture income', async () => {
    const { cmp, recordPaymentGw, recurringCreate, success } = make();
    cmp.selectedLoan.set(LENT);
    await cmp.recordPayment({ amount: 100, date: '2026-06-01', accountId: 'acc1', note: null });
    expect(recordPaymentGw).toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith('budget.loan.messages.paymentRecorded');
    expect(recurringCreate).toHaveBeenCalledTimes(1);
    const payload = recurringCreate.mock.calls[0][0] as { type: string };
    expect(payload.type).toBe('income');
  });

  it('recordPayment sur une dette avec compte → écriture spending', async () => {
    const { cmp, recurringCreate } = make();
    cmp.selectedLoan.set(BORROWED);
    await cmp.recordPayment({ amount: 50, date: '2026-06-01', accountId: 'acc1', note: null });
    const payload = recurringCreate.mock.calls[0][0] as { type: string };
    expect(payload.type).toBe('spending');
  });

  it('recordPayment sans compte → pas d’écriture récurrente', async () => {
    const { cmp, recurringCreate } = make();
    cmp.selectedLoan.set(LENT);
    await cmp.recordPayment({ amount: 100, date: '2026-06-01', accountId: null, note: null });
    expect(recurringCreate).not.toHaveBeenCalled();
  });

  it('deleteLoan annulé → delete non appelé', async () => {
    const { cmp, del } = make({ confirmDelete: () => Promise.resolve(false) });
    await cmp.deleteLoan('l1');
    expect(del).not.toHaveBeenCalled();
  });

  it('deleteLoan confirmé → delete(id) + toast', async () => {
    const { cmp, del, success } = make();
    await cmp.deleteLoan('l1');
    expect(del).toHaveBeenCalledWith('l1');
    expect(success).toHaveBeenCalledWith('budget.loan.messages.deleted');
  });

  it('lentVMs / borrowedVMs : split par direction, totaux et netDirection', () => {
    const { cmp } = make();
    expect(cmp.lentVMs().map((v) => v.loan.id)).toEqual(['l1']);
    expect(cmp.borrowedVMs().map((v) => v.loan.id)).toEqual(['l2']);
    expect(cmp.lentTotal()).toBe(600);
    expect(cmp.borrowedTotal()).toBe(200);
    expect(cmp.netDirection()).toBe('positive');
  });
});
