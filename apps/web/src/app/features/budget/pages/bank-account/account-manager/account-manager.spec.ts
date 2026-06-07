import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { BankAccountGateway } from '../../../domain/gateways/bank-account.gateway';
import { RecurringEntryGateway } from '../../../domain/gateways/recurring-entry.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { TranslocoService } from '@jsverse/transloco';
import { AccountManager } from './account-manager';

const ACC = {
  id: 'a',
  name: 'Courant',
  type: 'courant',
  initialBalance: 100,
  color: '#1',
  dotColor: '#2',
};
const LIV = {
  id: 'liv',
  name: 'Livret',
  type: 'épargne',
  initialBalance: 0,
  color: '#3',
  dotColor: '#4',
};
const DECO = [
  { account: ACC, color: '#1', dot: '#2' },
  { account: LIV, color: '#3', dot: '#4' },
];

type Cmp = {
  newAccountName: { set: (v: string) => void };
  newAccountType: { set: (v: string) => void };
  newAccountBalance: { set: (v: number) => void };
  selectedAccountId: { set: (v: string | null) => void };
  createAccount: () => Promise<void>;
  updateAccountName: (a: unknown, e: Event) => Promise<void> | void;
  updateAccountBalance: (a: unknown, e: Event) => Promise<void> | void;
  deleteAccount: (a: unknown) => Promise<void>;
};

function inputEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

function make(
  opts: {
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    del?: ReturnType<typeof vi.fn>;
    entryUpdate?: ReturnType<typeof vi.fn>;
    entryDelete?: ReturnType<typeof vi.fn>;
    choose?: () => Promise<'confirm' | 'alternative' | 'cancel'>;
    confirm?: () => Promise<boolean>;
    entries?: unknown[];
  } = {},
) {
  const create = opts.create ?? vi.fn(() => of(ACC));
  const update = opts.update ?? vi.fn(() => of(ACC));
  const del = opts.del ?? vi.fn(() => of(undefined));
  const entryUpdate = opts.entryUpdate ?? vi.fn(() => of({}));
  const entryDelete = opts.entryDelete ?? vi.fn(() => of(undefined));
  TestBed.configureTestingModule({
    providers: [
      { provide: BankAccountGateway, useValue: { create, update, delete: del } },
      { provide: RecurringEntryGateway, useValue: { update: entryUpdate, delete: entryDelete } },
      { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn() } },
      {
        provide: ConfirmService,
        useValue: {
          choose: opts.choose ?? (() => Promise.resolve('cancel')),
          confirm: opts.confirm ?? (() => Promise.resolve(true)),
        },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(AccountManager, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(AccountManager);
  fixture.componentRef.setInput('decoratedAccounts', DECO);
  fixture.componentRef.setInput('entries', opts.entries ?? []);
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    create,
    update,
    del,
    entryUpdate,
    entryDelete,
  };
}

describe('AccountManager', () => {
  it('createAccount appelle le gateway et émet accountsChanged', async () => {
    const { fixture, cmp, create } = make();
    const spy = vi.fn();
    fixture.componentInstance.accountsChanged.subscribe(spy);
    cmp.newAccountName.set('Vacances');
    cmp.newAccountType.set('épargne');
    cmp.newAccountBalance.set(50);
    await cmp.createAccount();
    expect(create).toHaveBeenCalledWith({
      name: 'Vacances',
      type: 'épargne',
      initialBalance: 50,
      color: null,
      dotColor: null,
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('createAccount ne fait rien si le nom est vide', async () => {
    const { cmp, create } = make();
    cmp.newAccountName.set('   ');
    await cmp.createAccount();
    expect(create).not.toHaveBeenCalled();
  });

  it('updateAccountName envoie le compte COMPLET mergé et émet accountsChanged', async () => {
    const { fixture, cmp, update } = make();
    const spy = vi.fn();
    fixture.componentInstance.accountsChanged.subscribe(spy);
    await cmp.updateAccountName(ACC, inputEvent('Renommé'));
    expect(update).toHaveBeenCalledWith('a', {
      name: 'Renommé',
      type: 'courant',
      initialBalance: 100,
      color: '#1',
      dotColor: '#2',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('updateAccountName vide → pas d’update, émet accountsChanged (annulation)', async () => {
    const { fixture, cmp, update } = make();
    const spy = vi.fn();
    fixture.componentInstance.accountsChanged.subscribe(spy);
    await cmp.updateAccountName(ACC, inputEvent('   '));
    expect(update).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('deleteAccount sans entrées → confirm puis delete + les deux events (comme l’original)', async () => {
    const { fixture, cmp, del } = make({ entries: [], confirm: () => Promise.resolve(true) });
    const accSpy = vi.fn();
    const entSpy = vi.fn();
    fixture.componentInstance.accountsChanged.subscribe(accSpy);
    fixture.componentInstance.entriesChanged.subscribe(entSpy);
    await cmp.deleteAccount(LIV);
    expect(del).toHaveBeenCalledWith('liv');
    expect(accSpy).toHaveBeenCalledTimes(1);
    expect(entSpy).toHaveBeenCalledTimes(1); // l'original bumpait _refresh inconditionnellement
  });

  it('deleteAccount avec entrées + réassignation → entryGateway.update ×N, delete, les deux events', async () => {
    const entries = [
      {
        id: 'e1',
        accountId: 'liv',
        label: 'x',
        amount: 1,
        type: 'expense',
        dayOfMonth: 5,
        date: null,
        endDate: null,
        category: null,
        payslipKey: null,
        memberId: null,
        toAccountId: null,
        autoPost: false,
        autoPostSince: null,
      },
    ];
    const { fixture, cmp, del, entryUpdate } = make({
      entries,
      choose: () => Promise.resolve('confirm'),
    });
    const accSpy = vi.fn();
    const entSpy = vi.fn();
    fixture.componentInstance.accountsChanged.subscribe(accSpy);
    fixture.componentInstance.entriesChanged.subscribe(entSpy);
    await cmp.deleteAccount(LIV);
    expect(entryUpdate).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('liv');
    expect(accSpy).toHaveBeenCalledTimes(1);
    expect(entSpy).toHaveBeenCalledTimes(1);
  });

  it('deleteAccount avec entrées + suppression → entryGateway.delete ×N + les deux events', async () => {
    const entries = [
      {
        id: 'e1',
        accountId: 'liv',
        label: 'x',
        amount: 1,
        type: 'expense',
        dayOfMonth: 5,
        date: null,
        endDate: null,
        category: null,
        payslipKey: null,
        memberId: null,
        toAccountId: null,
        autoPost: false,
        autoPostSince: null,
      },
    ];
    const { fixture, cmp, del, entryDelete } = make({
      entries,
      choose: () => Promise.resolve('alternative'),
    });
    const entSpy = vi.fn();
    fixture.componentInstance.entriesChanged.subscribe(entSpy);
    await cmp.deleteAccount(LIV);
    expect(entryDelete).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('liv');
    expect(entSpy).toHaveBeenCalledTimes(1);
  });

  it('deleteAccount : échec d’op entrée → toaster.error, compte NON supprimé', async () => {
    const entries = [
      {
        id: 'e1',
        accountId: 'liv',
        label: 'x',
        amount: 1,
        type: 'expense',
        dayOfMonth: 5,
        date: null,
        endDate: null,
        category: null,
        payslipKey: null,
        memberId: null,
        toAccountId: null,
        autoPost: false,
        autoPostSince: null,
      },
    ];
    const { cmp, del } = make({
      entries,
      choose: () => Promise.resolve('confirm'),
      entryUpdate: vi.fn(() => throwError(() => new Error('boom'))),
    });
    await cmp.deleteAccount(LIV);
    expect(del).not.toHaveBeenCalled();
  });

  it('deleteAccount annulé (sans entrées) → rien', async () => {
    const { cmp, del } = make({ entries: [], confirm: () => Promise.resolve(false) });
    await cmp.deleteAccount(LIV);
    expect(del).not.toHaveBeenCalled();
  });

  it('deleteAccount AVEC entrées annulé (choose=cancel) → ni entrée ni compte touchés', async () => {
    const entries = [
      {
        id: 'e1',
        accountId: 'liv',
        label: 'x',
        amount: 1,
        type: 'expense',
        dayOfMonth: 5,
        date: null,
        endDate: null,
        category: null,
        payslipKey: null,
        memberId: null,
        toAccountId: null,
        autoPost: false,
        autoPostSince: null,
      },
    ];
    const { cmp, del, entryUpdate, entryDelete } = make({
      entries,
      choose: () => Promise.resolve('cancel'),
    });
    await cmp.deleteAccount(LIV);
    expect(del).not.toHaveBeenCalled();
    expect(entryUpdate).not.toHaveBeenCalled();
    expect(entryDelete).not.toHaveBeenCalled();
  });

  it('deleteAccount du compte sélectionné → selectedAccountId remis à null', async () => {
    const { fixture, cmp, del } = make({ entries: [], confirm: () => Promise.resolve(true) });
    cmp.selectedAccountId.set('liv');
    await cmp.deleteAccount(LIV);
    expect(del).toHaveBeenCalledWith('liv');
    expect(fixture.componentInstance.selectedAccountId()).toBeNull();
  });
});
