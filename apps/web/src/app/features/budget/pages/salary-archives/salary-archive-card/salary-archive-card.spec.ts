import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { SalaryArchive } from '../../../domain/models/salary-archive.model';
import { SalaryArchiveCard } from './salary-archive-card';

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

function mount(opts: { archive?: SalaryArchive; expanded?: boolean } = {}) {
  TestBed.configureTestingModule({
    imports: [
      SalaryArchiveCard,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(SalaryArchiveCard);
  fixture.componentRef.setInput('archive', opts.archive ?? arch({}));
  fixture.componentRef.setInput('expanded', opts.expanded ?? false);
  fixture.componentRef.setInput('remaining', 1050);
  fixture.componentRef.setInput('monthLabel', 'Janvier 2026');
  fixture.componentRef.setInput('accountName', null);
  fixture.detectChanges();
  return fixture;
}

describe('SalaryArchiveCard', () => {
  it('replié : affiche le label de mois et le salaire, pas la grille KPI', () => {
    const el = mount({ expanded: false }).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Janvier 2026');
    expect(el.textContent).toContain('2,000.00');
    expect(el.querySelector('app-salary-archive-kpi-grid')).toBeNull();
  });

  it('déplié : monte la grille KPI et le détail dépenses', () => {
    const fixture = mount({
      archive: arch({
        spendings: [{ label: 'Courses', amount: 30, date: '2026-01-05', category: 'food' }],
      }),
      expanded: true,
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-salary-archive-kpi-grid')).not.toBeNull();
    expect(el.textContent).toContain('Courses');
  });

  it('émet toggle au clic sur l’en-tête', () => {
    const fixture = mount({ expanded: false });
    let toggled = false;
    fixture.componentInstance.toggled.subscribe(() => (toggled = true));
    const header = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    header.click();
    expect(toggled).toBe(true);
  });

  it('émet edit et delete depuis les actions (déplié)', () => {
    const fixture = mount({ expanded: true });
    let edited = false;
    let removed = false;
    fixture.componentInstance.edit.subscribe(() => (edited = true));
    fixture.componentInstance.delete.subscribe(() => (removed = true));
    const el = fixture.nativeElement as HTMLElement;
    const btns = [...el.querySelectorAll('button')];
    const edit = btns.find((b) => b.getAttribute('aria-label')?.includes('editAria')) as
      | HTMLButtonElement
      | undefined;
    const del = btns.find((b) => b.getAttribute('aria-label')?.includes('deleteAria')) as
      | HTMLButtonElement
      | undefined;
    edit?.click();
    del?.click();
    expect(edited).toBe(true);
    expect(removed).toBe(true);
  });
});
