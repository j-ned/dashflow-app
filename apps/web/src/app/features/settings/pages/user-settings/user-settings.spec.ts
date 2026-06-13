import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../auth/domain/auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';
import { BillingGateway } from '@core/billing/billing.gateway';
import { EntitlementStore } from '@core/entitlements/entitlement.store';
import { UserSettings } from './user-settings';

function mount(opts: { checkout?: string } = {}) {
  const success = vi.fn();
  const reload = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    imports: [
      UserSettings,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      provideRouter([]),
      {
        provide: AuthStore,
        useValue: {
          email: () => 'a@b.c',
          displayName: () => 'Alice',
          avatarUrl: () => null,
          userInitial: () => 'A',
          hasPassword: () => true,
          totpEnabled: () => false,
          encryptionVersion: () => 1,
        },
      },
      { provide: CryptoStore, useValue: { isUnlocked: () => true, getMasterKey: () => null } },
      { provide: ConfirmService, useValue: { confirm: () => Promise.resolve(false) } },
      { provide: Toaster, useValue: { success, error: vi.fn() } },
      { provide: BillingGateway, useValue: { openPortal: vi.fn() } },
      {
        provide: EntitlementStore,
        useValue: { planKey: () => 'solo', reload, can: () => false, limitOf: () => null },
      },
    ],
  });
  const fixture = TestBed.createComponent(UserSettings);
  if (opts.checkout !== undefined) {
    fixture.componentRef.setInput('checkout', opts.checkout);
  }
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, success, reload };
}

describe('UserSettings (smoke)', () => {
  it('monte les 6 sections, dont billing', () => {
    const { el } = mount();
    expect(el.querySelector('app-profile-section')).not.toBeNull();
    expect(el.querySelector('app-password-section')).not.toBeNull();
    expect(el.querySelector('app-two-factor-section')).not.toBeNull();
    expect(el.querySelector('app-billing-section')).not.toBeNull();
    expect(el.querySelector('app-encryption-section')).not.toBeNull();
    expect(el.querySelector('app-danger-zone-section')).not.toBeNull();
  });
});

describe('UserSettings — retour de paiement', () => {
  it('checkout=success déclenche le toast et le reload une seule fois', () => {
    const { success, reload } = mount({ checkout: 'success' });
    expect(success).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith('billing.success');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('sans checkout, ni toast ni reload', () => {
    const { success, reload } = mount();
    expect(success).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
