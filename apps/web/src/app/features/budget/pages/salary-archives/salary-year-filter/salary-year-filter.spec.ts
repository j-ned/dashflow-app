import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { SalaryYearFilter } from './salary-year-filter';

function mount(years: string[], selected: string | null) {
  TestBed.configureTestingModule({
    imports: [
      SalaryYearFilter,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(SalaryYearFilter);
  fixture.componentRef.setInput('years', years);
  fixture.componentRef.setInput('selected', selected);
  fixture.detectChanges();
  return fixture;
}

describe('SalaryYearFilter', () => {
  it('rend un bouton par année + le bouton "toutes"', () => {
    const el = mount(['2026', '2025'], null).nativeElement as HTMLElement;
    expect(el.textContent).toContain('2026');
    expect(el.textContent).toContain('2025');
    expect(el.textContent).toContain('budget.salaryArchive.allYears');
  });

  it('émet selectYear(year) au clic sur une année', () => {
    const fixture = mount(['2026', '2025'], null);
    let emitted: string | null | undefined;
    fixture.componentInstance.selectYear.subscribe((y) => (emitted = y));
    const btn = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '2025',
    ) as HTMLButtonElement;
    btn.click();
    expect(emitted).toBe('2025');
  });

  it('émet selectYear(null) au clic sur "toutes"', () => {
    const fixture = mount(['2026', '2025'], '2026');
    let emitted: string | null | undefined = 'unset';
    fixture.componentInstance.selectYear.subscribe((y) => (emitted = y));
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement; // 1er = "toutes"
    btn.click();
    expect(emitted).toBeNull();
  });
});
