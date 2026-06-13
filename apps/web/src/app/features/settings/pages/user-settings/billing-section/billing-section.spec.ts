import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { BillingGateway } from '@core/billing/billing.gateway';
import { EntitlementStore } from '@core/entitlements/entitlement.store';
import type { PlanKey } from '@core/entitlements/entitlement.types';
import { BillingSection } from './billing-section';

function setup(planKey: PlanKey | null) {
  const openPortal = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    imports: [
      BillingSection,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: BillingGateway, useValue: { openPortal } },
      { provide: EntitlementStore, useValue: { planKey: () => planKey, reload: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(BillingSection);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, openPortal };
}

describe('BillingSection', () => {
  it('plan payant affiche le bouton portal et appelle openPortal au clic', () => {
    const { el, openPortal } = setup('family');
    const portalBtn = el.querySelector<HTMLButtonElement>('[data-testid="billing-manage"]');
    expect(portalBtn).not.toBeNull();
    expect(el.querySelector('[data-testid="billing-choose"]')).toBeNull();

    portalBtn!.click();
    expect(openPortal).toHaveBeenCalledTimes(1);
  });

  it('plan family_health affiche aussi le bouton portal', () => {
    const { el } = setup('family_health');
    expect(el.querySelector('[data-testid="billing-manage"]')).not.toBeNull();
  });

  it('plan solo affiche le lien upgrade et pas le bouton portal', () => {
    const { el } = setup('solo');
    const upgradeLink = el.querySelector<HTMLAnchorElement>('[data-testid="billing-choose"]');
    expect(upgradeLink).not.toBeNull();
    expect(upgradeLink!.getAttribute('href')).toBe('/upgrade');
    expect(el.querySelector('[data-testid="billing-manage"]')).toBeNull();
  });

  it('plan null (entitlement non chargé) affiche le lien upgrade', () => {
    const { el } = setup(null);
    expect(el.querySelector('[data-testid="billing-choose"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="billing-manage"]')).toBeNull();
  });
});
