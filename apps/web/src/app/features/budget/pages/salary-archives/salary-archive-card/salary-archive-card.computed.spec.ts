import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { SalaryArchiveCard } from './salary-archive-card';
import { SalaryArchive } from '../../../domain/models/salary-archive.model';

const ARCHIVE: SalaryArchive = {
  id: 'computed:2026-08',
  accountId: null,
  month: '2026-08',
  salary: 2050.4,
  totalExpenses: 600,
  totalSpendings: 85.25,
  spendings: [],
  payslipKey: null,
};

describe('SalaryArchiveCard — mois calculé', () => {
  function render(computed: boolean) {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(SalaryArchiveCard);
    const inputs = {
      archive: ARCHIVE,
      expanded: true,
      remaining: 1365.15,
      monthLabel: 'Août 2026',
      computed,
    };
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return (id: string) => el.querySelector(`[data-testid="${id}"]`);
  }

  it('affiche le badge « Calculé » et renvoie vers le relevé au lieu d’éditer ou supprimer', () => {
    const q = render(true);
    expect(q('computed-badge')).not.toBeNull();
    expect(q('computed-source-link')?.getAttribute('href')).toBe('/budget/transactions');
  });

  it('une archive manuelle garde son édition, sans badge', () => {
    const q = render(false);
    expect(q('computed-badge')).toBeNull();
    expect(q('computed-source-link')).toBeNull();
  });
});
