import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingPricing } from './landing-pricing';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingPricing,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const f = TestBed.createComponent(LandingPricing);
  f.componentRef.setInput('premiumPrice', 49);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('LandingPricing', () => {
  it('rend le titre et le prix premium', () => {
    const el = mount();
    expect(el.textContent).toContain('landing.pricing.title');
    expect(el.textContent).toContain('49');
  });
});
