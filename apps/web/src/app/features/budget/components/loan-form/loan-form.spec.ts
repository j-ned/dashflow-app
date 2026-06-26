import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { LoanForm } from './loan-form';
import { Loan, LoanDirection } from '../../domain/models/loan.model';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: Omit<Loan, 'id'>) => void) => void };
};

const LOAN: Loan = {
  id: 'l1',
  memberId: 'm1',
  person: 'Cosette',
  direction: 'lent',
  amount: 150,
  remaining: 80,
  description: 'Avance',
  date: '2026-01-10',
  dueDate: '2026-02-10',
  dueDay: 5,
};

function make(initial: Loan | null, direction: LoanDirection = 'lent') {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(LoanForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(LoanForm);
  fixture.componentRef.setInput('direction', direction);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('LoanForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (création), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make(null);
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given un prêt initial valide, when submit, then émet le payload sans id', async () => {
    const { fixture, cmp } = make(LOAN);
    let emitted: Omit<Loan, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      memberId: 'm1',
      person: 'Cosette',
      direction: 'lent',
      amount: 150,
      remaining: 80,
      description: 'Avance',
      date: '2026-01-10',
      dueDate: '2026-02-10',
      dueDay: 5,
    });
  });

  it('given un prêt sans memberId/dueDate/dueDay, when submit, then émet null pour ces champs', async () => {
    const { fixture, cmp } = make({ ...LOAN, memberId: null, dueDate: null, dueDay: null });
    let emitted: Omit<Loan, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.memberId).toBeNull();
    expect(emitted?.dueDate).toBeNull();
    expect(emitted?.dueDay).toBeNull();
  });
});
