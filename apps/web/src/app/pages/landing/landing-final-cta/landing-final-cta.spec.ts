import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingFinalCta } from './landing-final-cta';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingFinalCta,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const f = TestBed.createComponent(LandingFinalCta);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('LandingFinalCta', () => {
  it('rend le titre du CTA final', () => {
    expect(mount().textContent).toContain('landing.finalCta.title');
  });
});
