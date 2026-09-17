import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/auth.store';
import { AuthEncryptionStore } from '@features/auth/auth-encryption.store';
import { RecoveryKeyCheckStore } from '@features/auth/recovery-key-check.store';
import { Toaster } from '@shared/components/toast/toast';
import { EncryptionSection } from './encryption-section';

type Cmp = {
  goToEncryptionSetup: () => void;
  openPanel: (panel: 'verify' | 'rotate') => void;
  panel: () => string;
  secret: { set: (v: string) => void };
  panelError: () => string;
  checkDue: () => boolean;
  settingsRecoveryKey: () => string;
  verifyRecoveryKey: () => Promise<void>;
  regenerateRecoveryKey: () => Promise<void>;
};

function mount(
  opts: {
    version?: number;
    rotateRecoveryKey?: () => Promise<string>;
    verifyRecoveryKey?: () => Promise<boolean>;
  } = {},
) {
  const success = vi.fn();
  const error = vi.fn();
  const rotateRecoveryKey = vi.fn(opts.rotateRecoveryKey ?? (() => Promise.resolve('NEW-KEY')));
  const verifyRecoveryKey = vi.fn(opts.verifyRecoveryKey ?? (() => Promise.resolve(true)));
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
      {
        provide: AuthStore,
        useValue: {
          encryptionVersion: () => opts.version ?? 1,
          user: () => ({ id: 'u1', hasEncryptionPassphrase: false }),
        },
      },
      { provide: AuthEncryptionStore, useValue: { rotateRecoveryKey, verifyRecoveryKey } },
      { provide: Toaster, useValue: { success, error } },
    ],
  });
  const fixture = TestBed.createComponent(EncryptionSection);
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    el: fixture.nativeElement as HTMLElement,
    success,
    rotateRecoveryKey,
    verifyRecoveryKey,
  };
}

describe('EncryptionSection', () => {
  beforeEach(() => localStorage.clear());

  it('version 0 : goToEncryptionSetup navigue vers /auth/encryption-setup', () => {
    const { cmp } = mount({ version: 0 });
    const navSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    cmp.goToEncryptionSetup();

    expect(navSpy).toHaveBeenCalledWith(['/auth/encryption-setup']);
  });

  describe('régénération de la clé de récupération', () => {
    it('la clé n’est montrée qu’après son enregistrement par le store (mot de passe saisi transmis)', async () => {
      const { cmp, rotateRecoveryKey } = mount();
      cmp.openPanel('rotate');
      cmp.secret.set('mon-mot-de-passe');

      await cmp.regenerateRecoveryKey();

      expect(rotateRecoveryKey).toHaveBeenCalledWith('mon-mot-de-passe');
      expect(cmp.settingsRecoveryKey()).toBe('NEW-KEY');
      expect(cmp.panel()).toBe('none');
      expect(cmp.checkDue()).toBe(false);
    });

    it('échec (mauvais mot de passe, refus serveur) → aucune clé affichée, erreur dans le panneau', async () => {
      const { cmp } = mount({ rotateRecoveryKey: () => Promise.reject(new Error('bad')) });
      cmp.openPanel('rotate');
      cmp.secret.set('faux');

      await cmp.regenerateRecoveryKey();

      expect(cmp.settingsRecoveryKey()).toBe('');
      expect(cmp.panel()).toBe('rotate');
      expect(cmp.panelError()).toBe('settings.encryption.feedback.regenFailed');
    });
  });

  describe('vérification de la clé de récupération', () => {
    it('jamais vérifiée sur cet appareil → rappel affiché', () => {
      const { el } = mount();

      expect(el.querySelector('[data-testid="recovery-check-due"]')).not.toBeNull();
    });

    it('clé valide (espaces ignorés) → date mémorisée, rappel retiré, toast', async () => {
      const { fixture, cmp, el, success, verifyRecoveryKey } = mount();
      cmp.openPanel('verify');
      cmp.secret.set(`${'ab'.repeat(16)} \n${'cd'.repeat(16)}`);

      await cmp.verifyRecoveryKey();
      fixture.detectChanges();

      expect(verifyRecoveryKey).toHaveBeenCalledWith('ab'.repeat(16) + 'cd'.repeat(16));
      expect(success).toHaveBeenCalledWith('settings.encryption.feedback.recoveryValid');
      expect(TestBed.inject(RecoveryKeyCheckStore).isDue()).toBe(false);
      expect(el.querySelector('[data-testid="recovery-check-due"]')).toBeNull();
    });

    it('clé qui n’ouvre rien → erreur dans le panneau, rappel maintenu', async () => {
      const { cmp, success } = mount({ verifyRecoveryKey: () => Promise.resolve(false) });
      cmp.openPanel('verify');
      cmp.secret.set('ab'.repeat(32));

      await cmp.verifyRecoveryKey();

      expect(cmp.panelError()).toBe('settings.encryption.feedback.recoveryInvalid');
      expect(success).not.toHaveBeenCalled();
      expect(cmp.checkDue()).toBe(true);
    });
  });
});
