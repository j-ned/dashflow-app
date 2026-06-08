import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Toaster } from '@shared/components/toast/toast';
import { TwoFactorSection } from './two-factor-section';

function mount(auth: Record<string, unknown> = {}) {
  const setup2FA = vi.fn(() => Promise.resolve({ qrCode: 'data:img', secret: 'SECRET' }));
  const verify2FA = vi.fn(() => Promise.resolve());
  const disable2FA = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    imports: [
      TwoFactorSection,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      {
        provide: AuthStore,
        useValue: { totpEnabled: () => false, setup2FA, verify2FA, disable2FA, ...auth },
      },
      { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(TwoFactorSection);
  fixture.detectChanges();
  return { fixture, setup2FA, verify2FA, disable2FA };
}
type Cmp = {
  totpSetup: () => { qrCode: string; secret: string } | null;
  totpVerifyCode: { set: (v: string) => void };
  setup2FA: () => Promise<void>;
  verify2FA: () => Promise<void>;
};

describe('TwoFactorSection', () => {
  it('setup2FA peuple totpSetup (QR)', async () => {
    const { fixture, setup2FA } = mount();
    const cmp = fixture.componentInstance as unknown as Cmp;
    await cmp.setup2FA();
    expect(setup2FA).toHaveBeenCalledTimes(1);
    expect(cmp.totpSetup()?.secret).toBe('SECRET');
  });

  it('verify2FA avec code 6 chiffres appelle auth.verify2FA', async () => {
    const { fixture, verify2FA } = mount();
    const cmp = fixture.componentInstance as unknown as Cmp;
    cmp.totpVerifyCode.set('123456');
    await cmp.verify2FA();
    expect(verify2FA).toHaveBeenCalledWith('123456');
  });

  it('verify2FA ignore un code incomplet', async () => {
    const { fixture, verify2FA } = mount();
    const cmp = fixture.componentInstance as unknown as Cmp;
    cmp.totpVerifyCode.set('12');
    await cmp.verify2FA();
    expect(verify2FA).not.toHaveBeenCalled();
  });
});
