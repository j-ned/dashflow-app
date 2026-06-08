import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { SalaryArchive } from '../../../domain/models/salary-archive.model';
import { SalaryArchiveKpiGrid } from './salary-archive-kpi-grid';

const arch = (p: Partial<SalaryArchive>): SalaryArchive => ({
  id: 'a',
  accountId: null,
  month: '2026-01',
  salary: 2000,
  totalExpenses: 800,
  totalSpendings: 150,
  spendings: [],
  payslipKey: null,
  ...p,
});

function mount(a: SalaryArchive, remaining: number) {
  TestBed.configureTestingModule({
    imports: [
      SalaryArchiveKpiGrid,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(SalaryArchiveKpiGrid);
  fixture.componentRef.setInput('archive', a);
  fixture.componentRef.setInput('remaining', remaining);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SalaryArchiveKpiGrid', () => {
  it('affiche salaire, charges, dépenses et clés KPI', () => {
    const el = mount(arch({ salary: 2000, totalExpenses: 800, totalSpendings: 150 }), 1050);
    expect(el.textContent).toContain('2,000.00');
    expect(el.textContent).toContain('800.00');
    expect(el.textContent).toContain('150.00');
    expect(el.textContent).toContain('budget.salaryArchive.kpi.salary');
    expect(el.textContent).toContain('budget.salaryArchive.kpi.remaining');
  });

  it('reste négatif affiché tel quel', () => {
    const el = mount(arch({}), -50);
    expect(el.textContent).toContain('50.00');
  });
});
