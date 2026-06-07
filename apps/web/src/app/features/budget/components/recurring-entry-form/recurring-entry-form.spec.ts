import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RecurringEntryForm } from './recurring-entry-form';

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
