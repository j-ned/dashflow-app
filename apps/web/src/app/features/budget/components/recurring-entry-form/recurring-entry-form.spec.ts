import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RecurringEntryForm } from './recurring-entry-form';
import { BankAccount } from '../../domain/models/bank-account.model';

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
  it("émet autoPost=true et fige autoPostSince au mois courant à l'activation", () => {
    const fixture = mount();
    const cmp = fixture.componentInstance as unknown as {
      form: {
        controls: {
          label: { setValue: (v: string) => void };
          amount: { setValue: (v: number) => void };
          dayOfMonth: { setValue: (v: number) => void };
          autoPost: { setValue: (v: boolean) => void };
        };
      };
      submit: () => void;
    };
    let emitted: { autoPost: boolean; autoPostSince: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    cmp.form.controls.label.setValue('Loyer');
    cmp.form.controls.amount.setValue(800);
    cmp.form.controls.dayOfMonth.setValue(5);
    cmp.form.controls.autoPost.setValue(true);
    cmp.submit();

    expect(emitted!.autoPost).toBe(true);
    expect(emitted!.autoPostSince).toBe(new Date().toISOString().slice(0, 7));
  });

  it('émet autoPost=false et autoPostSince=null quand décoché', () => {
    const fixture = mount();
    const cmp = fixture.componentInstance as unknown as {
      form: {
        controls: {
          label: { setValue: (v: string) => void };
          amount: { setValue: (v: number) => void };
          dayOfMonth: { setValue: (v: number) => void };
        };
      };
      submit: () => void;
    };
    let emitted: { autoPost: boolean; autoPostSince: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    cmp.form.controls.label.setValue('Loyer');
    cmp.form.controls.amount.setValue(800);
    cmp.form.controls.dayOfMonth.setValue(5);
    cmp.submit();

    expect(emitted!.autoPost).toBe(false);
    expect(emitted!.autoPostSince).toBeNull();
  });
});

const SAVINGS: BankAccount = {
  id: 'liv', name: 'Livret A', type: 'épargne', initialBalance: 0, color: null, dotColor: null,
};

type FormCmp = {
  form: {
    controls: {
      label: { setValue: (v: string) => void };
      amount: { setValue: (v: number) => void };
      dayOfMonth: { setValue: (v: number | null) => void };
      toAccountId: { setValue: (v: string) => void };
    };
    invalid: boolean;
  };
  destination: { set: (v: 'third_party' | 'my_account') => void };
  submit: () => void;
};

function mountExpense() {
  TestBed.configureTestingModule({
    imports: [
      RecurringEntryForm,
      TranslocoTestingModule.forRoot({
        langs: {}, translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
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
  it("émet type='transfer' + toAccountId quand destination = mon compte", () => {
    const fixture = mountExpense();
    const cmp = fixture.componentInstance as unknown as FormCmp;
    let emitted: { type: string; toAccountId: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    cmp.destination.set('my_account');
    cmp.form.controls.label.setValue('Épargne mensuelle');
    cmp.form.controls.amount.setValue(200);
    cmp.form.controls.dayOfMonth.setValue(5);
    cmp.form.controls.toAccountId.setValue('liv');
    fixture.detectChanges();
    cmp.submit();

    expect(emitted!.type).toBe('transfer');
    expect(emitted!.toAccountId).toBe('liv');
  });

  it("émet type='expense' + toAccountId=null quand destination = tiers", () => {
    const fixture = mountExpense();
    const cmp = fixture.componentInstance as unknown as FormCmp;
    let emitted: { type: string; toAccountId: string | null } | null = null;
    fixture.componentInstance.submitted.subscribe((v) => (emitted = v as never));

    cmp.form.controls.label.setValue('Netflix');
    cmp.form.controls.amount.setValue(15.99);
    cmp.form.controls.dayOfMonth.setValue(5);
    cmp.submit();

    expect(emitted!.type).toBe('expense');
    expect(emitted!.toAccountId).toBeNull();
  });

  it('rend le formulaire invalide si destination = mon compte sans toAccountId', () => {
    const fixture = mountExpense();
    const cmp = fixture.componentInstance as unknown as FormCmp;

    cmp.destination.set('my_account');
    cmp.form.controls.label.setValue('Épargne');
    cmp.form.controls.amount.setValue(200);
    cmp.form.controls.dayOfMonth.setValue(5);
    fixture.detectChanges();

    expect(cmp.form.invalid).toBe(true);
  });
});
