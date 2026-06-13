import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { Upgrade } from './upgrade';
import { BillingGateway } from '@core/billing/billing.gateway';
import { Toaster } from '@shared/components/toast/toast';

type Inputs = { feature?: string; reason?: string; returnUrl?: string; checkout?: string };
type Mocks = {
  checkout?: ReturnType<typeof vi.fn>;
  info?: ReturnType<typeof vi.fn>;
};

function build(inputs: Inputs = {}, mocks: Mocks = {}) {
  const checkout = mocks.checkout ?? vi.fn().mockResolvedValue(undefined);
  const info = mocks.info ?? vi.fn();
  TestBed.configureTestingModule({
    imports: [
      Upgrade,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: BillingGateway, useValue: { checkout, openPortal: vi.fn() } },
      { provide: Toaster, useValue: { info, success: vi.fn(), error: vi.fn() } },
    ],
  });
  const f = TestBed.createComponent(Upgrade);
  if (inputs.feature) f.componentRef.setInput('feature', inputs.feature);
  if (inputs.reason) f.componentRef.setInput('reason', inputs.reason);
  if (inputs.returnUrl) f.componentRef.setInput('returnUrl', inputs.returnUrl);
  if (inputs.checkout) f.componentRef.setInput('checkout', inputs.checkout);
  f.detectChanges();
  return { f, checkout, info };
}

function mount(inputs: Inputs = {}) {
  return build(inputs).f.nativeElement as HTMLElement;
}

const card = (el: HTMLElement, key: string) =>
  el.querySelector<HTMLElement>(`[data-testid="pricing-card-${key}"]`);

describe('Upgrade', () => {
  it('affiche les plans payants (contexte app, Solo masqué)', () => {
    const el = mount();
    expect(card(el, 'solo')).toBeNull();
    expect(card(el, 'family')).not.toBeNull();
    expect(card(el, 'family_health')).not.toBeNull();
  });

  it('met en avant le plan requis par la feature bloquée', () => {
    const el = mount({ feature: 'medical.access' });
    // medical.access → family_health
    expect(card(el, 'family_health')!.className).toContain('border-ib-blue');
    expect(card(el, 'family')!.className).toContain('border-border');
  });

  it('met en avant Famille pour une feature budget', () => {
    const el = mount({ feature: 'budget.import' });
    expect(card(el, 'family')!.className).toContain('border-ib-blue');
  });

  it('?checkout=cancel : affiche un toast info au montage', () => {
    const { info } = build({ checkout: 'cancel' });
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('sans ?checkout : aucun toast au montage', () => {
    const { info } = build();
    expect(info).not.toHaveBeenCalled();
  });

  it('startCheckout délègue à BillingGateway.checkout avec la clé du plan', () => {
    const { f, checkout } = build();
    const instance = f.componentInstance as unknown as {
      startCheckout: (plan: 'family' | 'family_health') => void;
    };

    instance.startCheckout('family');

    expect(checkout).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledWith('family');
  });
});
