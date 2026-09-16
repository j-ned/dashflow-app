import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/auth.store';
import { Toaster } from '@shared/components/toast/toast';
import { TwoFactorSection } from './two-factor-section';

function mount(auth: Record<string, unknown> = {}) {
  const setup2FA = vi.fn(() => Promise.resolve({ qrCode: 'data:img', secret: 'SECRET' }));
  const verify2FA = vi.fn(() => Promise.resolve(['abcde-fghjk', 'mnpqr-stuvw']));
  const disable2FA = vi.fn(() => Promise.resolve());
  const backupCodesRemaining = vi.fn(() => Promise.resolve(7));
  const regenerateBackupCodes = vi.fn(() => Promise.resolve(['zzzzz-zzzzz']));
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
        useValue: {
          totpEnabled: () => false,
          setup2FA,
          verify2FA,
          disable2FA,
          backupCodesRemaining,
          regenerateBackupCodes,
          ...auth,
        },
      },
      { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(TwoFactorSection);
  fixture.detectChanges();
  return { fixture, setup2FA, verify2FA, disable2FA, backupCodesRemaining, regenerateBackupCodes };
}
type Cmp = {
  totpSetup: () => { qrCode: string; secret: string } | null;
  totpVerifyCode: { set: (v: string) => void };
  disablePassword: { set: (v: string) => void };
  backupCodes: () => string[] | null;
  remaining: () => { count: number } | null;
  setup2FA: () => Promise<void>;
  verify2FA: () => Promise<void>;
  regenerateBackupCodes: () => Promise<void>;
  dismissBackupCodes: () => void;
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

  it("verify2FA expose les codes de secours renvoyés, jusqu'à « j'ai enregistré »", async () => {
    const { fixture } = mount();
    const cmp = fixture.componentInstance as unknown as Cmp;
    cmp.totpVerifyCode.set('123456');
    await cmp.verify2FA();
    expect(cmp.backupCodes()).toEqual(['abcde-fghjk', 'mnpqr-stuvw']);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="backup-codes-panel"]'),
    ).not.toBeNull();
    cmp.dismissBackupCodes();
    expect(cmp.backupCodes()).toBeNull();
  });

  it('2FA active : charge le nombre de codes restants', async () => {
    const { fixture, backupCodesRemaining } = mount({ totpEnabled: () => true });
    const cmp = fixture.componentInstance as unknown as Cmp;
    await fixture.whenStable();
    fixture.detectChanges();
    expect(backupCodesRemaining).toHaveBeenCalled();
    expect(cmp.remaining()).toEqual({ count: 7 });
    expect(
      fixture.nativeElement.querySelector('[data-testid="backup-codes-remaining"]'),
    ).not.toBeNull();
  });

  it('regenerateBackupCodes : mot de passe requis, puis nouveaux codes affichés', async () => {
    const { fixture, regenerateBackupCodes } = mount({ totpEnabled: () => true });
    const cmp = fixture.componentInstance as unknown as Cmp;
    await cmp.regenerateBackupCodes();
    expect(regenerateBackupCodes).not.toHaveBeenCalled();
    cmp.disablePassword.set('motdepasse-long-12');
    await cmp.regenerateBackupCodes();
    expect(regenerateBackupCodes).toHaveBeenCalledWith('motdepasse-long-12');
    expect(cmp.backupCodes()).toEqual(['zzzzz-zzzzz']);
  });
});
