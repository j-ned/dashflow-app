import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { BankAccount } from './bank-account';

const CURRENT = {
  id: 'a',
  name: 'Courant',
  type: 'courant',
  initialBalance: 1000,
  color: null,
  dotColor: null,
};
const SAVINGS = { ...CURRENT, id: 'b', name: 'Livret', type: 'épargne', initialBalance: 0 };

// Prélèvement du 1er non pointé : il y a toujours une échéance « à traiter » (sauf le 1er au matin,
// où dayOfMonth 1 est déjà échu aussi).
const RENT = {
  id: 'r1',
  accountId: 'a',
  label: 'Loyer',
  amount: 800,
  type: 'expense',
  dayOfMonth: 1,
  date: null,
  endDate: null,
  toAccountId: null,
  category: null,
  memberId: null,
  payslipKey: null,
};

function renderPage(entries: unknown[] = [], accounts: unknown[] = [CURRENT, SAVINGS]) {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { fr: {} },
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      provideHttpClient(),
      provideRouter([]),
      {
        provide: RecurringEntryGateway,
        useValue: { getAll: () => of(entries), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      },
      { provide: BankAccountGateway, useValue: { getAll: () => of(accounts) } },
      { provide: MemberGateway, useValue: { getAll: () => of([]) } },
      { provide: AccountTransactionGateway, useValue: { getAll: () => of([]), create: vi.fn() } },
      { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      { provide: ConfirmService, useValue: { confirm: vi.fn(), delete: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(BankAccount);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const tab = (name: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (t) => t.textContent?.trim() === name,
    );
  return { fixture, el, tab };
}

const precedes = (a: Element | null, b: Element | null) =>
  !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('BankAccount : mise en page simplifiée', () => {
  it('le solde est la première chose affichée, avant les échéances à traiter', () => {
    const { el } = renderPage([RENT]);

    expect(
      precedes(el.querySelector('app-bank-balance-band'), el.querySelector('app-bank-todo-panel')),
    ).toBe(true);
  });

  it('un seul bouton d’ajout pour toute la page', () => {
    const { el } = renderPage();

    expect(el.querySelectorAll('[data-testid="add-toggle"]').length).toBe(1);
  });

  it('détail du mois : l’onglet Revenus est affiché par défaut, et lui seul', () => {
    const { el } = renderPage();

    expect(el.querySelector('app-bank-incomes-table')).not.toBeNull();
    expect(el.querySelector('app-bank-expense-columns')).toBeNull();
    expect(el.querySelector('app-bank-transfers-panel')).toBeNull();
    expect(el.querySelector('app-bank-timeline')).toBeNull();
  });

  it.each([
    ['budget.bankAccount.tabs.outflows', 'app-bank-expense-columns'],
    ['budget.bankAccount.tabs.transfers', 'app-bank-transfers-panel'],
    ['budget.bankAccount.tabs.timeline', 'app-bank-timeline'],
  ])('choisir l’onglet « %s » affiche %s à la place des revenus', (tabName, selector) => {
    const { fixture, el, tab } = renderPage();

    tab(tabName)!.click();
    fixture.detectChanges();

    expect(el.querySelector(selector)).not.toBeNull();
    expect(el.querySelector('app-bank-incomes-table')).toBeNull();
  });

  it('un seul compte et aucun virement : pas d’onglet Virements vide', () => {
    const { tab } = renderPage([], [CURRENT]);

    expect(tab('budget.bankAccount.tabs.transfers')).toBeUndefined();
    expect(tab('budget.bankAccount.tabs.outflows')).toBeDefined();
  });
});
