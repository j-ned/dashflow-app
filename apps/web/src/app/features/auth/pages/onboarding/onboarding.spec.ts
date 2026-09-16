import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { BankAccountGateway } from '@features/budget/domain/gateways/bank-account.gateway';
import { MemberGateway } from '@features/budget/domain/gateways/member.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { Onboarding, OnboardingStep } from './onboarding';

type Cmp = {
  step: () => OnboardingStep;
  hasExistingData: () => boolean;
  members: { set: (v: string[]) => void };
  accountName: { set: (v: string) => void };
  accountBalance: { set: (v: string | number) => void };
  entries: {
    set: (
      v: { label: string; amount: string; type: 'income' | 'expense'; dayOfMonth: number }[],
    ) => void;
  };
  submitMembers: () => Promise<void>;
  skipMembers: () => void;
  submitAccount: () => Promise<void>;
  submitEntries: () => Promise<void>;
  skipEntries: () => void;
  protect: () => void;
};

function make(opts: { accounts?: unknown[]; accountCreateFails?: boolean } = {}) {
  const memberCreate = vi.fn((m: { firstName: string }) => of({ id: `m-${m.firstName}`, ...m }));
  const accountCreate = vi.fn(() =>
    opts.accountCreateFails ? throwError(() => ({ status: 500 })) : of({ id: 'acc-1' }),
  );
  const entryCreate = vi.fn((e: { label: string }) => of({ id: `e-${e.label}`, ...e }));
  const navigate = vi.fn(() => Promise.resolve(true));
  const error = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MemberGateway, useValue: { create: memberCreate } },
      {
        provide: BankAccountGateway,
        useValue: { getAll: () => of(opts.accounts ?? []), create: accountCreate },
      },
      { provide: RecurringEntryGateway, useValue: { create: entryCreate } },
      { provide: Router, useValue: { navigate } },
      { provide: Toaster, useValue: { error, success: vi.fn() } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Onboarding, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Onboarding);
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    memberCreate,
    accountCreate,
    entryCreate,
    navigate,
    error,
  };
}

describe('Onboarding', () => {
  it('démarre à l’étape 1 sur un compte vide', async () => {
    const { fixture, cmp } = make();
    await fixture.whenStable();
    expect(cmp.step()).toBe(1);
    expect(cmp.hasExistingData()).toBe(false);
  });

  it('un compte qui a déjà des données saute directement à la protection (étape 4)', async () => {
    const { fixture, cmp } = make({ accounts: [{ id: 'a1' }] });
    await fixture.whenStable();
    expect(cmp.step()).toBe(4);
    expect(cmp.hasExistingData()).toBe(true);
  });

  it('étape 1 : crée un membre par prénom rempli, ignore les vides, passe à 2', async () => {
    const { cmp, memberCreate } = make();
    cmp.members.set(['  Léa ', '', 'Tom']);
    await cmp.submitMembers();
    expect(memberCreate).toHaveBeenCalledTimes(2);
    expect(memberCreate).toHaveBeenCalledWith({ firstName: 'Léa', lastName: '', color: null });
    expect(cmp.step()).toBe(2);
  });

  it('étape 1 : « je gère seul » ne crée rien et passe à 2', () => {
    const { cmp, memberCreate } = make();
    cmp.skipMembers();
    expect(memberCreate).not.toHaveBeenCalled();
    expect(cmp.step()).toBe(2);
  });

  it('étape 2 : crée le compte avec le solde saisi en nombre, puis étape 3', async () => {
    const { cmp, accountCreate } = make();
    cmp.skipMembers();
    cmp.accountName.set('Compte joint');
    cmp.accountBalance.set('1250.5');
    await cmp.submitAccount();
    expect(accountCreate).toHaveBeenCalledWith({
      name: 'Compte joint',
      type: 'courant',
      initialBalance: 1250.5,
      color: null,
      dotColor: null,
    });
    expect(cmp.step()).toBe(3);
  });

  it('étape 2 : échec de création → toast erreur, on reste à 2', async () => {
    const { cmp, error } = make({ accountCreateFails: true });
    cmp.skipMembers();
    cmp.accountName.set('X');
    await cmp.submitAccount();
    expect(error).toHaveBeenCalledWith('auth.onboarding.error');
    expect(cmp.step()).toBe(2);
  });

  it('étape 3 : crée les lignes valides (libellé + montant > 0), rattachées au compte créé, jour borné 1..31', async () => {
    const { cmp, entryCreate } = make();
    cmp.skipMembers();
    cmp.accountName.set('Courant');
    await cmp.submitAccount();
    cmp.entries.set([
      { label: 'Salaire', amount: '2300', type: 'income', dayOfMonth: 28 },
      { label: 'Loyer', amount: '850', type: 'expense', dayOfMonth: 40 },
      { label: '', amount: '10', type: 'expense', dayOfMonth: 1 },
      { label: 'Vide', amount: '0', type: 'expense', dayOfMonth: 1 },
    ]);
    await cmp.submitEntries();
    expect(entryCreate).toHaveBeenCalledTimes(2);
    expect(entryCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        label: 'Salaire',
        amount: 2300,
        type: 'income',
        dayOfMonth: 28,
        accountId: 'acc-1',
      }),
    );
    expect(entryCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ label: 'Loyer', dayOfMonth: 31 }),
    );
    expect(cmp.step()).toBe(4);
  });

  it('étape 4 : « Protéger mes données » ouvre le flux de chiffrement existant', () => {
    const { cmp, navigate } = make();
    cmp.skipMembers();
    cmp.skipEntries();
    cmp.protect();
    expect(navigate).toHaveBeenCalledWith(['/auth/encryption-setup'], { replaceUrl: true });
  });
});
