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
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('LandingPricing', () => {
  it('rend le titre de section', () => {
    const el = mount();
    expect(el.textContent).toContain('landing.pricing.title');
  });

  it('délègue aux trois cartes de tarifs', () => {
    const el = mount();
    expect(el.querySelector('[data-testid="pricing-card-solo"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="pricing-card-family"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="pricing-card-family_health"]')).not.toBeNull();
  });
});
