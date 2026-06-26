import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RecurringEntryForm } from './recurring-entry-form';
import { BankAccount } from '../../domain/models/bank-account.model';

type RecurringEntryModel = {
  label: string;
  amount: number;
  dayOfMonth: number | null;
  date: string;
  endDate: string;
  toAccountId: string;
  category: string;
  memberId: string;
  autoPost: boolean;
};

type Cmp = {
  model: {
    (): RecurringEntryModel;
    set: (v: RecurringEntryModel) => void;
    update: (fn: (m: RecurringEntryModel) => RecurringEntryModel) => void;
  };
  entryForm: () => { invalid: () => boolean };
  destination: { set: (v: 'third_party' | 'my_account') => void };
  setTransferMode: (m: 'recurring' | 'one_time') => void;
  pendingFile: { set: (f: File | null) => void };
  submitForm: (event?: Event) => Promise<void>;
};

function patch(cmp: Cmp, values: Partial<RecurringEntryModel>) {
  cmp.model.update((m) => ({ ...m, ...values }));
}

function mount() {
  TestBed.configureTestingModule({
    imports: [
      RecurringEntryForm,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(RecurringEntryForm);
  fixture.componentRef.setInput('forcedType', 'expense');
  fixture.detectChanges();
  return fixture;
}

describe('RecurringEntryForm — autoPost', () => {
  it("émet autoPost=true et fige autoPostSince au mois courant à l'activation", async () => {
    const fixture = mount();
    const cmp = fixture.componentInstance as unknown as Cmp;
    let emitted: { autoPost: boolean; autoPostSince: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    patch(cmp, { label: 'Loyer', amount: 800, dayOfMonth: 5, autoPost: true });
    await cmp.submitForm();
    await fixture.whenStable();

    expect(emitted!.autoPost).toBe(true);
    expect(emitted!.autoPostSince).toBe(new Date().toISOString().slice(0, 7));
  });

  it('émet autoPost=false et autoPostSince=null quand décoché', async () => {
    const fixture = mount();
    const cmp = fixture.componentInstance as unknown as Cmp;
    let emitted: { autoPost: boolean; autoPostSince: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    patch(cmp, { label: 'Loyer', amount: 800, dayOfMonth: 5 });
    await cmp.submitForm();
    await fixture.whenStable();

    expect(emitted!.autoPost).toBe(false);
    expect(emitted!.autoPostSince).toBeNull();
  });
});

const SAVINGS: BankAccount = {
  id: 'liv',
  name: 'Livret A',
  type: 'épargne',
  initialBalance: 0,
  color: null,
  dotColor: null,
};

function mountExpense() {
  TestBed.configureTestingModule({
    imports: [
      RecurringEntryForm,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(RecurringEntryForm);
  fixture.componentRef.setInput('forcedType', 'expense');
  fixture.componentRef.setInput('forcedAccountId', 'a');
  fixture.componentRef.setInput('accounts', [SAVINGS]);
  fixture.detectChanges();
  return fixture;
}

describe('RecurringEntryForm — destination prélèvement → livret', () => {
  it("émet type='transfer' + toAccountId quand destination = mon compte", async () => {
    const fixture = mountExpense();
    const cmp = fixture.componentInstance as unknown as Cmp;
    let emitted: { type: string; toAccountId: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    cmp.destination.set('my_account');
    patch(cmp, { label: 'Épargne mensuelle', amount: 200, dayOfMonth: 5, toAccountId: 'liv' });
    fixture.detectChanges();
    await cmp.submitForm();
    await fixture.whenStable();

    expect(emitted!.type).toBe('transfer');
    expect(emitted!.toAccountId).toBe('liv');
  });

  it("émet type='expense' + toAccountId=null quand destination = tiers", async () => {
    const fixture = mountExpense();
    const cmp = fixture.componentInstance as unknown as Cmp;
    let emitted: { type: string; toAccountId: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    patch(cmp, { label: 'Netflix', amount: 15.99, dayOfMonth: 5 });
    await cmp.submitForm();
    await fixture.whenStable();

    expect(emitted!.type).toBe('expense');
    expect(emitted!.toAccountId).toBeNull();
  });

  it('rend le formulaire invalide si destination = mon compte sans toAccountId', () => {
    const fixture = mountExpense();
    const cmp = fixture.componentInstance as unknown as Cmp;

    cmp.destination.set('my_account');
    patch(cmp, { label: 'Épargne', amount: 200, dayOfMonth: 5 });
    fixture.detectChanges();

    expect(cmp.entryForm().invalid()).toBe(true);
  });
});

const COURANT: BankAccount = {
  id: 'a',
  name: 'Courant',
  type: 'courant',
  initialBalance: 0,
  color: null,
  dotColor: null,
};

const EXPENSE_ENTRY = {
  id: 'e1',
  accountId: 'a',
  toAccountId: null,
  label: 'Netflix',
  amount: 16,
  type: 'expense' as const,
  dayOfMonth: 10,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  memberId: null,
  autoPost: false,
  autoPostSince: null,
};

function mountEdit(entry: typeof EXPENSE_ENTRY) {
  TestBed.configureTestingModule({
    imports: [
      RecurringEntryForm,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(RecurringEntryForm);
  fixture.componentRef.setInput('initial', entry);
  fixture.componentRef.setInput('accounts', [COURANT, SAVINGS]);
  fixture.detectChanges();
  return fixture;
}

describe('RecurringEntryForm — ÉDITION prélèvement → livret (repro bug)', () => {
  it("édition d'une dépense → bascule my_account + livret → émet type='transfer'", async () => {
    const fixture = mountEdit(EXPENSE_ENTRY);
    const cmp = fixture.componentInstance as unknown as Cmp;
    let emitted: { type: string; toAccountId: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    cmp.destination.set('my_account');
    patch(cmp, { toAccountId: 'liv' });
    fixture.detectChanges();

    expect(cmp.entryForm().invalid()).toBe(false); // le formulaire doit être valide
    await cmp.submitForm();
    await fixture.whenStable();

    expect(emitted).not.toBeNull(); // submit doit émettre (sinon "rien ne se passe")
    expect(emitted!.type).toBe('transfer');
    expect(emitted!.toAccountId).toBe('liv');
  });

  it('DOM : clic radio « mon compte » + select livret → bouton activé', () => {
    const fixture = mountEdit(EXPENSE_ENTRY);
    const el: HTMLElement = fixture.nativeElement;

    // 2e radio = « Vers un de mes comptes »
    const radios = el.querySelectorAll<HTMLInputElement>('input[type="radio"][name="destination"]');
    expect(radios.length).toBe(2);
    radios[1].click();
    radios[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const select = el.querySelector<HTMLSelectElement>('#re-to-account');
    expect(select).not.toBeNull(); // le sélecteur de compte doit apparaître
    select!.value = 'liv';
    // La directive [formField] synchronise sur 'input' (pas 'change').
    select!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const submitBtn = el.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitBtn).not.toBeNull();
    expect(submitBtn!.disabled).toBe(false); // sinon « rien ne se passe » au clic
  });

  it('bascule « mon compte » SANS livret → bouton désactivé AVEC message d’erreur (anti « rien ne se passe »)', () => {
    const fixture = mountEdit(EXPENSE_ENTRY);
    const el: HTMLElement = fixture.nativeElement;

    const radios = el.querySelectorAll<HTMLInputElement>('input[type="radio"][name="destination"]');
    radios[1].click();
    radios[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // toAccountId requis-mais-vide : le bouton est désactivé (correct) MAIS il faut un feedback.
    const submitBtn = el.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitBtn!.disabled).toBe(true);

    const requiredMsg = el.querySelector('[data-testid="to-account-required"]');
    expect(requiredMsg).not.toBeNull(); // sans message, l’utilisateur croit que « rien ne se passe »
  });
});

describe('RecurringEntryForm — mode virement, patch & fichier', () => {
  it('setTransferMode vide les champs du mode opposé', () => {
    TestBed.configureTestingModule({
      imports: [
        RecurringEntryForm,
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(RecurringEntryForm);
    fixture.componentRef.setInput('forcedType', 'transfer');
    fixture.componentRef.setInput('accounts', [COURANT, SAVINGS]);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as Cmp;

    patch(cmp, { dayOfMonth: 5, endDate: '2026-12-31' });
    cmp.setTransferMode('one_time');
    expect(cmp.model().dayOfMonth).toBeNull();
    expect(cmp.model().endDate).toBe('');

    patch(cmp, { date: '2026-06-01' });
    cmp.setTransferMode('recurring');
    expect(cmp.model().date).toBe('');
  });

  it("initial patche le formulaire à l'édition", () => {
    const fixture = mountEdit(EXPENSE_ENTRY);
    const cmp = fixture.componentInstance as unknown as Cmp;
    expect(cmp.model().label).toBe('Netflix');
  });

  it('fichier en attente → fileAttached émis au submit', async () => {
    const fixture = mountExpense();
    const cmp = fixture.componentInstance as unknown as Cmp;
    patch(cmp, { label: 'Bulletin', amount: 10, dayOfMonth: 5 });

    const file = new File(['x'], 'p.pdf', { type: 'application/pdf' });
    cmp.pendingFile.set(file);
    let attached: File | undefined;
    fixture.componentInstance.fileAttached.subscribe((f) => (attached = f));
    await cmp.submitForm();
    await fixture.whenStable();

    expect(attached).toBe(file);
  });
});
