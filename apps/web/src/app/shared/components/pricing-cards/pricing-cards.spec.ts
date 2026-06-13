import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { PricingCards } from './pricing-cards';
import type { PlanKey } from '@core/entitlements/entitlement.types';

function build(inputs: { context?: 'public' | 'app'; highlightPlan?: PlanKey } = {}) {
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
  return f;
}

function mount(inputs: { context?: 'public' | 'app'; highlightPlan?: PlanKey } = {}) {
  return build(inputs).nativeElement as HTMLElement;
}

const card = (el: HTMLElement, key: PlanKey) =>
  el.querySelector<HTMLElement>(`[data-testid="pricing-card-${key}"]`);

const cta = (el: HTMLElement, key: PlanKey) =>
  el.querySelector<HTMLElement>(`[data-testid="pricing-cta-${key}"]`);

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

  it('public : le CTA est un lien vers /auth/register (pas un bouton)', () => {
    const el = mount();
    const ctaFamily = cta(el, 'family');
    expect(ctaFamily).not.toBeNull();
    expect(ctaFamily!.tagName).toBe('A');
    expect(ctaFamily!.getAttribute('href')).toContain('/auth/register');
  });

  it.each([{ key: 'family' as PlanKey }, { key: 'family_health' as PlanKey }])(
    'contexte app : le CTA du plan $key est un bouton qui émet selectPlan avec sa clé',
    ({ key }) => {
      const f = build({ context: 'app' });
      const el = f.nativeElement as HTMLElement;
      const emitted: PlanKey[] = [];
      f.componentInstance.selectPlan.subscribe((k: PlanKey) => emitted.push(k));

      const button = cta(el, key);
      expect(button).not.toBeNull();
      expect(button!.tagName).toBe('BUTTON');

      button!.click();
      f.detectChanges();

      expect(emitted).toEqual([key]);
    },
  );

  it("contexte app : un clic n'émet rien tant qu'il n'a pas eu lieu", () => {
    const f = build({ context: 'app' });
    const spy = vi.fn();
    f.componentInstance.selectPlan.subscribe(spy);
    expect(spy).not.toHaveBeenCalled();
  });
});
