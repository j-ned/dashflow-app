import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { BudgetUsageBar } from './budget-usage-bar';

function render(inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(BudgetUsageBar);
  const all = {
    totalIncome: 3000,
    totalAllExpenses: 1500,
    usagePercent: 50,
    totalMonthlyExpenses: 1200,
    monthlyAnnualExpenses: 100,
    totalMonthSpendings: 200,
    ...inputs,
  };
  for (const [key, value] of Object.entries(all)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

describe('BudgetUsageBar', () => {
  it('revenus connus : répartition, jauge et pourcentage, sans mention d’exclusion', () => {
    const q = render({});

    expect(q('usage-breakdown')?.textContent).toContain('1,200');
    expect(q('usage-gauge')).not.toBeNull();
    expect(q('usage-excludes')).toBeNull();
  });

  it('salaire variable non saisi : la répartition reste visible et le revenu exclu est nommé', () => {
    const q = render({ unknownIncomes: ['Salaire Sumecatronic'], totalIncome: 0 });

    expect(q('usage-breakdown')?.textContent).toContain('1,200');
    expect(q('usage-excludes')?.textContent).toContain('budget.bankAccount.usage.excludesHint');
  });

  it('salaire variable non saisi : pas de pourcentage calculé sur des revenus partiels', () => {
    const q = render({ unknownIncomes: ['Salaire'], usagePercent: 140 });

    expect(q('usage-gauge')).toBeNull();
  });

  it('ni revenu ni charge : le bloc n’apparaît pas', () => {
    const q = render({ totalIncome: 0, totalAllExpenses: 0 });

    expect(q('usage-breakdown')).toBeNull();
  });
});
