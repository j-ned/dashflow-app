import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BankTransfersPanel } from './bank-transfers-panel';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';

function re(over: Partial<RecurringEntry>): RecurringEntry {
  return {
    id: 't1',
    memberId: null,
    accountId: 'cur',
    toAccountId: 'liv',
    label: 'Épargne',
    amount: 100,
    type: 'transfer',
    dayOfMonth: 5,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    autoPost: false,
    autoPostSince: null,
    variableAmount: false,
    skippedMonths: [],
    ...over,
  };
}

function mount(transfers: RecurringEntry[]) {
  TestBed.configureTestingModule({
    imports: [
      BankTransfersPanel,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(BankTransfersPanel);
  const ref = fixture.componentRef;
  ref.setInput('recurringTransfers', transfers);
  ref.setInput('monthOneTimeTransfers', []);
  ref.setInput('totalOneTimeOutgoing', 0);
  ref.setInput('totalOneTimeIncoming', 0);
  ref.setInput('selectedAccountId', null);
  ref.setInput('memberMap', new Map());
  ref.setInput('accountNameById', (id: string | null) => (id ? 'Compte' : null));
  ref.setInput('isExpensePassed', () => false);
  ref.setInput('spendingMonthLabel', 'juin 2026');
  ref.setInput('accountsCount', 2);
  fixture.detectChanges();
  return fixture;
}

describe('BankTransfersPanel : badge auto', () => {
  it('affiche le badge « auto » pour un virement même avec autoPost=false', () => {
    const el: HTMLElement = mount([re({ autoPost: false })]).nativeElement;
    expect(el.querySelector('[data-testid="auto-badge"]')).not.toBeNull();
  });
});

describe('BankTransfersPanel : badge date de fin (régression pipe imbriqué dans transloco)', () => {
  it("n'explose pas quand un virement récurrent a une endDate", () => {
    expect(() => mount([re({ endDate: '2026-12-31' })])).not.toThrow();
  });
});

describe('BankTransfersPanel : virement sans destinataire', () => {
  it('signale qu’un virement dont le compte destinataire a été supprimé est suspendu', () => {
    const el: HTMLElement = mount([re({ toAccountId: null })]).nativeElement;
    expect(el.querySelector('[data-testid="missing-target-badge"]')).not.toBeNull();
  });

  it('ne signale rien quand le destinataire existe', () => {
    const el: HTMLElement = mount([re({})]).nativeElement;
    expect(el.querySelector('[data-testid="missing-target-badge"]')).toBeNull();
  });
});
