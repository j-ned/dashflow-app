import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingProblem } from './landing-problem';
function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingProblem,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const f = TestBed.createComponent(LandingProblem);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}
describe('LandingProblem', () => {
  it('rend le titre du problème', () => {
    expect(mount().textContent).toContain('landing.problem.title');
  });
});
