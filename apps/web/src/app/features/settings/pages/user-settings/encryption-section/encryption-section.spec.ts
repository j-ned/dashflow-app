import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/domain/auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { Toaster } from '@shared/components/toast/toast';
import { EncryptionSection } from './encryption-section';

function mount(opts: { version?: number; masterKey?: unknown } = {}) {
  const success = vi.fn();
  const error = vi.fn();
  const wrapKey = vi.fn(() => Promise.resolve('wrapped'));
  TestBed.configureTestingModule({
    imports: [
      EncryptionSection,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { encryptionVersion: () => opts.version ?? 1 } },
      {
        provide: CryptoStore,
        useValue: {
          getMasterKey: () => opts.masterKey ?? null,
          generateRecoveryKey: () => 'RECOVERY-KEY',
          deriveWrappingKeyFromRecovery: () => Promise.resolve({} as CryptoKey),
          wrapKey,
        },
      },
      { provide: Toaster, useValue: { success, error } },
    ],
  });
  const fixture = TestBed.createComponent(EncryptionSection);
  fixture.detectChanges();
  return { fixture, success, error, wrapKey };
}

describe('EncryptionSection', () => {
  it('version 0 : goToEncryptionSetup navigue vers /auth/encryption-setup', () => {
    const { fixture } = mount({ version: 0 });
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const cmp = fixture.componentInstance as unknown as { goToEncryptionSetup: () => void };
    cmp.goToEncryptionSetup();
    expect(navSpy).toHaveBeenCalledWith(['/auth/encryption-setup']);
  });

  it('regenerateRecoveryKey sans masterKey → toast erreur, pas de wrap', async () => {
    const { fixture, error, wrapKey } = mount({ version: 1, masterKey: null });
    const cmp = fixture.componentInstance as unknown as {
      regenerateRecoveryKey: () => Promise<void>;
    };
    await cmp.regenerateRecoveryKey();
    expect(error).toHaveBeenCalledTimes(1);
    expect(wrapKey).not.toHaveBeenCalled();
  });

  it('regenerateRecoveryKey avec masterKey → wrap + settingsRecoveryKey peuplée', async () => {
    const { fixture, wrapKey } = mount({ version: 1, masterKey: {} });
    const cmp = fixture.componentInstance as unknown as {
      regenerateRecoveryKey: () => Promise<void>;
      settingsRecoveryKey: () => string;
    };
    await cmp.regenerateRecoveryKey();
    expect(wrapKey).toHaveBeenCalledTimes(1);
    expect(cmp.settingsRecoveryKey()).toBe('RECOVERY-KEY');
  });
});
