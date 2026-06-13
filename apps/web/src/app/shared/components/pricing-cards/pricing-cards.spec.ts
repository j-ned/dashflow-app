import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { PricingCards } from './pricing-cards';
import type { PlanKey } from '@core/entitlements/entitlement.types';

function mount(inputs: { context?: 'public' | 'app'; highlightPlan?: PlanKey } = {}) {
  TestBed.configureTestingModule({
    imports: [
      PricingCards,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const f = TestBed.createComponent(PricingCards);
  if (inputs.context) f.componentRef.setInput('context', inputs.context);
  if (inputs.highlightPlan) f.componentRef.setInput('highlightPlan', inputs.highlightPlan);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

const card = (el: HTMLElement, key: PlanKey) =>
  el.querySelector<HTMLElement>(`[data-testid="pricing-card-${key}"]`);

describe('PricingCards', () => {
  it('public : rend les 3 plans avec le plan Famille recommandé', () => {
    const el = mount();
    expect(card(el, 'solo')).not.toBeNull();
    expect(card(el, 'family')).not.toBeNull();
    expect(card(el, 'family_health')).not.toBeNull();

    const recommended = el.querySelector('[data-testid="pricing-recommended"]');
    expect(recommended).not.toBeNull();
    // Le badge "Recommandé" appartient à la carte Famille.
    expect(card(el, 'family')!.contains(recommended)).toBe(true);
  });

  it('public : le plan recommandé est mis en avant (bordure ib-blue)', () => {
    const el = mount();
    expect(card(el, 'family')!.className).toContain('border-ib-blue');
    expect(card(el, 'solo')!.className).toContain('border-border');
  });

  it('highlightPlan déplace la mise en avant vers le plan ciblé', () => {
    const el = mount({ highlightPlan: 'family_health' });
    expect(card(el, 'family_health')!.className).toContain('border-ib-blue');
    expect(card(el, 'family')!.className).toContain('border-border');
  });

  it('contexte app : masque la carte gratuite Solo', () => {
    const el = mount({ context: 'app' });
    expect(card(el, 'solo')).toBeNull();
    expect(card(el, 'family')).not.toBeNull();
    expect(card(el, 'family_health')).not.toBeNull();
  });
});
