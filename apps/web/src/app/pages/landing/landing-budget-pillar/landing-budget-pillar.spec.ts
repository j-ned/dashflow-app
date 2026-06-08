import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingBudgetPillar } from './landing-budget-pillar';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingBudgetPillar,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const f = TestBed.createComponent(LandingBudgetPillar);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('LandingBudgetPillar', () => {
  it('rend le titre budget', () => {
    expect(mount().textContent).toContain('landing.budget.title');
  });
});
