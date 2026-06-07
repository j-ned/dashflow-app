import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { EnvelopeGateway } from '../../domain/gateways/envelope.gateway';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Envelope } from '../../domain/models/envelope.model';
import { EnvelopeTransaction } from '../../domain/models/envelope-transaction.model';
import { Envelopes } from './envelopes';

const ENV: Envelope = {
  id: 'e1',
  memberId: 'm1',
  name: 'Vacances',
  type: 'vacances',
  balance: 300,
  target: null,
  color: '#0f0',
  dueDay: null,
};
const ENV2: Envelope = { ...ENV, id: 'e2', memberId: 'm2', name: 'Impôts', balance: 200 };
const NEW_DATA: Omit<Envelope, 'id'> = {
  memberId: 'm1',
  name: 'Noël',
  type: 'épargne',
  balance: 0,
  target: 500,
  color: '#0ff',
  dueDay: null,
};

type Cmp = {
  createEnvelope: (d: Omit<Envelope, 'id'>) => Promise<void>;
  updateEnvelope: (d: Omit<Envelope, 'id'>) => Promise<void>;
  creditEnvelope: (e: {
    amount: number;
    date: string;
    note: string | null;
    accountId: string | null;
  }) => Promise<void>;
  deleteEnvelope: (id: string) => Promise<void>;
  selectedEnvelope: { set: (v: Envelope | null) => void };
  filterMemberId: { set: (v: string | null) => void };
  filteredEnvelopes: () => Envelope[];
  totalBalance: () => number;
  recentByEnvelope: () => Map<string, { tx: EnvelopeTransaction; balanceAfter: number }[]>;
};

function make(
  opts: {
    envelopes?: Envelope[];
    transactions?: EnvelopeTransaction[];
    create?: ReturnType<typeof vi.fn>;
    confirmDelete?: () => Promise<boolean>;
  } = {},
) {
  const getAll = vi.fn(() => of(opts.envelopes ?? [ENV, ENV2]));
  const getAllTransactions = vi.fn(() => of(opts.transactions ?? []));
  const create = opts.create ?? vi.fn(() => of({ ...ENV, id: 'new' }));
  const update = vi.fn(() => of(ENV));
  const del = vi.fn(() => of(undefined));
  const updateBalance = vi.fn(() => of(ENV));
  const recurringCreate = vi.fn((_entry: unknown) => of({ id: 'r1' }));
  const success = vi.fn();
  const error = vi.fn();
  const createClose = vi.fn();
  const editClose = vi.fn();
  const creditClose = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      {
        provide: EnvelopeGateway,
        useValue: { getAll, getAllTransactions, create, update, delete: del, updateBalance },
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
  TestBed.overrideComponent(Envelopes, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Envelopes);
  const refs = fixture.componentInstance as unknown as {
    createModalRef: () => { open: () => void; close: () => void };
    editModalRef: () => { open: () => void; close: () => void };
    creditModalRef: () => { open: () => void; close: () => void };
    historyModalRef: () => { open: () => void; close: () => void };
  };
  refs.createModalRef = () => ({ open: vi.fn(), close: createClose });
  refs.editModalRef = () => ({ open: vi.fn(), close: editClose });
  refs.creditModalRef = () => ({ open: vi.fn(), close: creditClose });
  refs.historyModalRef = () => ({ open: vi.fn(), close: vi.fn() });
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    getAll,
    create,
    update,
    del,
    updateBalance,
    recurringCreate,
    success,
    error,
    createClose,
    editClose,
  };
}

describe('Envelopes', () => {
  it('createEnvelope succès : create + close + refetch + toast', async () => {
    const { fixture, cmp, create, createClose, success, getAll } = make();
    const before = getAll.mock.calls.length;
    await cmp.createEnvelope(NEW_DATA);
    fixture.detectChanges();
    expect(create).toHaveBeenCalledWith(NEW_DATA);
    expect(createClose).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith('budget.envelope.messages.created');
    expect(getAll.mock.calls.length).toBeGreaterThan(before);
  });

  it('createEnvelope échec : toast error, modale non fermée', async () => {
    const { cmp, createClose, success, error } = make({
      create: vi.fn(() => throwError(() => new Error('boom'))),
    });
    await cmp.createEnvelope(NEW_DATA);
    expect(error).toHaveBeenCalledWith('budget.envelope.messages.createError');
    expect(success).not.toHaveBeenCalled();
    expect(createClose).not.toHaveBeenCalled();
  });

  it('updateEnvelope sans sélection → no-op', async () => {
    const { cmp, update } = make();
    cmp.selectedEnvelope.set(null);
    await cmp.updateEnvelope(NEW_DATA);
    expect(update).not.toHaveBeenCalled();
  });

  it('updateEnvelope avec sélection → update(id, data) + toast', async () => {
    const { cmp, update, success } = make();
    cmp.selectedEnvelope.set(ENV);
    await cmp.updateEnvelope(NEW_DATA);
    expect(update).toHaveBeenCalledWith('e1', NEW_DATA);
    expect(success).toHaveBeenCalledWith('budget.envelope.messages.updated');
  });

  it('creditEnvelope avec compte source et montant positif → crée une écriture récurrente spending', async () => {
    const { cmp, updateBalance, recurringCreate, success } = make();
    cmp.selectedEnvelope.set(ENV);
    await cmp.creditEnvelope({ amount: 50, date: '2026-06-01', note: null, accountId: 'acc1' });
    expect(updateBalance).toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith('budget.envelope.messages.credited');
    expect(recurringCreate).toHaveBeenCalledTimes(1);
    const payload = recurringCreate.mock.calls[0][0] as {
      type: string;
      amount: number;
      accountId: string | null;
    };
    expect(payload.type).toBe('spending');
    expect(payload.amount).toBe(50);
    expect(payload.accountId).toBe('acc1');
  });

  it('creditEnvelope montant négatif → toast debited, pas d’écriture récurrente', async () => {
    const { cmp, recurringCreate, success } = make();
    cmp.selectedEnvelope.set(ENV);
    await cmp.creditEnvelope({ amount: -20, date: '2026-06-01', note: null, accountId: 'acc1' });
    expect(success).toHaveBeenCalledWith('budget.envelope.messages.debited');
    expect(recurringCreate).not.toHaveBeenCalled();
  });

  it('creditEnvelope sans compte source → pas d’écriture récurrente', async () => {
    const { cmp, recurringCreate } = make();
    cmp.selectedEnvelope.set(ENV);
    await cmp.creditEnvelope({ amount: 50, date: '2026-06-01', note: null, accountId: null });
    expect(recurringCreate).not.toHaveBeenCalled();
  });

  it('deleteEnvelope annulé → delete non appelé', async () => {
    const { cmp, del } = make({ confirmDelete: () => Promise.resolve(false) });
    await cmp.deleteEnvelope('e1');
    expect(del).not.toHaveBeenCalled();
  });

  it('deleteEnvelope confirmé → delete(id) + toast', async () => {
    const { cmp, del, success } = make();
    await cmp.deleteEnvelope('e1');
    expect(del).toHaveBeenCalledWith('e1');
    expect(success).toHaveBeenCalledWith('budget.envelope.messages.deleted');
  });

  it('filteredEnvelopes : null → tout, sinon filtre par membre', () => {
    const { cmp } = make();
    expect(cmp.filteredEnvelopes().length).toBe(2);
    cmp.filterMemberId.set('m1');
    expect(cmp.filteredEnvelopes().map((e) => e.id)).toEqual(['e1']);
  });

  it('totalBalance : somme des soldes filtrés', () => {
    const { cmp } = make();
    expect(cmp.totalBalance()).toBe(500);
    cmp.filterMemberId.set('m2');
    expect(cmp.totalBalance()).toBe(200);
  });

  it('recentByEnvelope : délègue au domaine (groupage par enveloppe)', () => {
    const { cmp } = make({
      transactions: [
        { id: 't1', envelopeId: 'e1', amount: 100, date: '2026-01-01', note: null },
        { id: 't2', envelopeId: 'e1', amount: 50, date: '2026-02-01', note: null },
      ],
    });
    expect(cmp.recentByEnvelope().get('e1')?.length).toBe(2);
  });
});
