import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, of, throwError } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { AuthStore } from '../../domain/auth.store';
import { ForgotPassword } from './forgot-password';

type Cmp = {
  submitEmail: () => Promise<void>;
  submitReset: () => Promise<void>;
  resendCode: () => Promise<void>;
  backToEmail: () => void;
  recoverWithKey: () => Promise<void>;
  skipRecovery: () => Promise<void>;
  onRecoveryKeyInput: (e: Event) => void;
  loading: () => boolean;
  error: () => string;
  success: () => string;
  step: () => 'email' | 'reset' | 'recovery' | 'done';
  pendingEmail: () => string;
  recoveryKeyValue: () => string;
  emailForm: { setValue: (v: { email: string }) => void };
  resetForm: {
    setValue: (v: { code: string; newPassword: string; confirmPassword: string }) => void;
  };
};

type AuthUserShape = { encryptionVersion: number };
type KeyMaterialShape = { recoveryWrappedKey: string | null };

type AuthStoreMock = {
  forgotPassword: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  user: () => AuthUserShape | null;
  getKeyMaterial: () => KeyMaterialShape | null;
};

type CryptoStoreMock = {
  unlockWithRecovery: ReturnType<typeof vi.fn>;
  getMasterKey: ReturnType<typeof vi.fn>;
  generateSalt: ReturnType<typeof vi.fn>;
  deriveWrappingKey: ReturnType<typeof vi.fn>;
  deriveWrappingKeyFromRecovery: ReturnType<typeof vi.fn>;
  wrapKey: ReturnType<typeof vi.fn>;
};

type ApiClientMock = {
  patch: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function makeComponent(
  opts: {
    forgotPassword?: (email: string) => Promise<void>;
    resetPassword?: (email: string, code: string, newPassword: string) => Promise<void>;
    login?: (email: string, password: string) => Promise<unknown>;
    logout?: () => Promise<void>;
    user?: AuthUserShape | null;
    keyMaterial?: KeyMaterialShape | null;
    crypto?: Partial<CryptoStoreMock>;
    apiPatch?: () => Observable<unknown>;
    apiPost?: () => Observable<unknown>;
  } = {},
) {
  const auth: AuthStoreMock = {
    forgotPassword: vi.fn(opts.forgotPassword ?? (() => Promise.resolve())),
    resetPassword: vi.fn(opts.resetPassword ?? (() => Promise.resolve())),
    login: vi.fn(opts.login ?? (() => Promise.resolve(undefined))),
    logout: vi.fn(opts.logout ?? (() => Promise.resolve())),
    user: () => opts.user ?? null,
    getKeyMaterial: () => opts.keyMaterial ?? null,
  };

  const crypto: CryptoStoreMock = {
    unlockWithRecovery: vi.fn(opts.crypto?.unlockWithRecovery ?? (() => Promise.resolve())),
    getMasterKey: vi.fn(opts.crypto?.getMasterKey ?? (() => ({}) as CryptoKey)),
    generateSalt: vi.fn(opts.crypto?.generateSalt ?? (() => new Uint8Array([1, 2, 3]))),
    deriveWrappingKey: vi.fn(
      opts.crypto?.deriveWrappingKey ?? (() => Promise.resolve({} as CryptoKey)),
    ),
    deriveWrappingKeyFromRecovery: vi.fn(
      opts.crypto?.deriveWrappingKeyFromRecovery ?? (() => Promise.resolve({} as CryptoKey)),
    ),
    wrapKey: vi.fn(opts.crypto?.wrapKey ?? (() => Promise.resolve('wrapped'))),
  };

  const api: ApiClientMock = {
    patch: vi.fn(opts.apiPatch ?? (() => of(undefined))),
    post: vi.fn(opts.apiPost ?? (() => of(undefined))),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: CryptoStore, useValue: crypto },
      { provide: ApiClient, useValue: api },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(ForgotPassword, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(ForgotPassword);
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    auth,
    crypto,
    api,
  };
}

const VALID_EMAIL = { email: 'user@dash.flow' };
const VALID_RESET = {
  code: '123456',
  newPassword: 'longenoughpass',
  confirmPassword: 'longenoughpass',
};

function setRecoveryKey(cmp: Cmp, value: string): void {
  cmp.onRecoveryKeyInput({ target: { value } } as unknown as Event);
}

describe('ForgotPassword — réinitialisation multi-étapes (sécurité E2EE)', () => {
  describe('submitEmail — demande de code', () => {
    it('succès → mémorise l\'email et passe à l\'étape reset', async () => {
      const { cmp, auth } = makeComponent();
      cmp.emailForm.setValue(VALID_EMAIL);

      await cmp.submitEmail();

      expect(auth.forgotPassword).toHaveBeenCalledTimes(1);
      expect(auth.forgotPassword).toHaveBeenCalledWith(VALID_EMAIL.email);
      expect(cmp.step()).toBe('reset');
      expect(cmp.pendingEmail()).toBe(VALID_EMAIL.email);
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('échec gateway avec body structuré → erreur du serveur, reste à l\'étape email', async () => {
      const { cmp, auth } = makeComponent({
        forgotPassword: () =>
          Promise.reject({ error: { error: 'RATE_LIMITED' } } as unknown as Error),
      });
      cmp.emailForm.setValue(VALID_EMAIL);

      await expect(cmp.submitEmail()).resolves.toBeUndefined();

      expect(auth.forgotPassword).toHaveBeenCalledTimes(1);
      expect(cmp.step()).toBe('email');
      expect(cmp.error()).toBe('RATE_LIMITED');
      expect(cmp.loading()).toBe(false);
    });

    it('échec sans body structuré → fallback générique i18n', async () => {
      const { cmp } = makeComponent({
        forgotPassword: () => Promise.reject(new Error('network')),
      });
      cmp.emailForm.setValue(VALID_EMAIL);

      await cmp.submitEmail();

      expect(cmp.error()).toBe('auth.forgot.errors.generic');
      expect(cmp.step()).toBe('email');
      expect(cmp.loading()).toBe(false);
    });

    it('formulaire invalide (email vide) → n\'appelle pas la gateway', async () => {
      const { cmp, auth } = makeComponent();
      cmp.emailForm.setValue({ email: '' });

      await cmp.submitEmail();

      expect(auth.forgotPassword).not.toHaveBeenCalled();
      expect(cmp.step()).toBe('email');
      expect(cmp.loading()).toBe(false);
    });
  });

  describe('submitReset — soumission code + nouveau mot de passe', () => {
    it('reset OK, compte non chiffré (encryptionVersion 0) → logout puis étape done', async () => {
      const { cmp, auth } = makeComponent({ user: { encryptionVersion: 0 } });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);

      await cmp.submitReset();

      expect(auth.resetPassword).toHaveBeenCalledWith(
        VALID_EMAIL.email,
        VALID_RESET.code,
        VALID_RESET.newPassword,
      );
      expect(auth.login).toHaveBeenCalledWith(VALID_EMAIL.email, VALID_RESET.newPassword);
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(cmp.step()).toBe('done');
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('reset OK, compte chiffré (encryptionVersion 1) → passe à l\'étape recovery, pas de logout', async () => {
      const { cmp, auth } = makeComponent({ user: { encryptionVersion: 1 } });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);

      await cmp.submitReset();

      expect(auth.login).toHaveBeenCalledTimes(1);
      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.step()).toBe('recovery');
      expect(cmp.loading()).toBe(false);
    });

    it('reset OK mais login échoue → étape done (catch interne), pas de logout', async () => {
      const { cmp, auth } = makeComponent({
        login: () => Promise.reject(new Error('login boom')),
      });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);

      await cmp.submitReset();

      expect(auth.resetPassword).toHaveBeenCalledTimes(1);
      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.step()).toBe('done');
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('resetPassword échoue → erreur codeInvalid, reste à l\'étape reset', async () => {
      const { cmp, auth } = makeComponent({
        resetPassword: () => Promise.reject(new Error('bad code')),
      });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);

      await expect(cmp.submitReset()).resolves.toBeUndefined();

      expect(auth.login).not.toHaveBeenCalled();
      expect(cmp.step()).toBe('reset');
      expect(cmp.error()).toBe('auth.forgot.errors.codeInvalid');
      expect(cmp.loading()).toBe(false);
    });

    it('formulaire reset invalide (mots de passe différents) → n\'appelle pas resetPassword', async () => {
      const { cmp, auth } = makeComponent();
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue({ ...VALID_RESET, confirmPassword: 'mismatchpass' });

      await cmp.submitReset();

      expect(auth.resetPassword).not.toHaveBeenCalled();
      expect(cmp.step()).toBe('reset');
      expect(cmp.loading()).toBe(false);
    });
  });

  describe('resendCode', () => {
    it('renvoi réussi → success défini, error vide', async () => {
      const { cmp, auth } = makeComponent();
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();

      await cmp.resendCode();

      expect(auth.forgotPassword).toHaveBeenCalledTimes(2);
      expect(auth.forgotPassword).toHaveBeenLastCalledWith(VALID_EMAIL.email);
      expect(cmp.success()).toBe('auth.forgot.success.codeResent');
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('échec du renvoi → error resendFailed, success vide', async () => {
      const { cmp } = makeComponent({
        forgotPassword: () => Promise.reject(new Error('rate limit')),
      });

      await expect(cmp.resendCode()).resolves.toBeUndefined();

      expect(cmp.error()).toBe('auth.forgot.errors.resendFailed');
      expect(cmp.success()).toBe('');
      expect(cmp.loading()).toBe(false);
    });
  });

  describe('backToEmail', () => {
    it('revient à l\'étape email et réinitialise erreur, succès et formulaire reset', async () => {
      const { cmp } = makeComponent({
        resetPassword: () => Promise.reject(new Error('bad code')),
      });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);
      await cmp.submitReset();
      expect(cmp.error()).not.toBe('');

      cmp.backToEmail();

      expect(cmp.step()).toBe('email');
      expect(cmp.error()).toBe('');
      expect(cmp.success()).toBe('');
    });
  });

  describe('onRecoveryKeyInput — normalisation', () => {
    it('supprime tous les espaces (espaces, tabs, retours ligne) de la clé saisie', () => {
      const { cmp } = makeComponent();

      setRecoveryKey(cmp, 'ab cd\tef\n01');

      expect(cmp.recoveryKeyValue()).toBe('abcdef01');
    });
  });

  describe('recoverWithKey — garde + seam injectée avant import dynamique', () => {
    it('clé de longueur != 64 → return immédiat, aucun appel crypto', async () => {
      const { cmp, crypto, auth } = makeComponent();
      setRecoveryKey(cmp, 'deadbeef'); // 8 chars

      await cmp.recoverWithKey();

      expect(crypto.unlockWithRecovery).not.toHaveBeenCalled();
      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('pas de recoveryWrappedKey en mémoire → erreur noRecoveryKey, pas de déchiffrement', async () => {
      const { cmp, crypto } = makeComponent({ keyMaterial: { recoveryWrappedKey: null } });
      setRecoveryKey(cmp, 'a'.repeat(64));

      await cmp.recoverWithKey();

      expect(cmp.error()).toBe('auth.forgot.errors.noRecoveryKey');
      expect(crypto.unlockWithRecovery).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('keyMaterial absent → erreur noRecoveryKey (optional chaining)', async () => {
      const { cmp, crypto } = makeComponent({ keyMaterial: null });
      setRecoveryKey(cmp, 'a'.repeat(64));

      await cmp.recoverWithKey();

      expect(cmp.error()).toBe('auth.forgot.errors.noRecoveryKey');
      expect(crypto.unlockWithRecovery).not.toHaveBeenCalled();
    });

    it('chemin complet de récupération → déchiffre, re-wrap, PATCH des clés, logout puis done', async () => {
      const apiPatch = vi.fn(() => of(undefined));
      const { cmp, crypto, auth, api } = makeComponent({
        keyMaterial: { recoveryWrappedKey: 'recovery-wrapped' },
        apiPatch,
      });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);
      const recoveryHex = 'a'.repeat(64);
      setRecoveryKey(cmp, recoveryHex);

      await cmp.recoverWithKey();

      expect(crypto.unlockWithRecovery).toHaveBeenCalledWith(recoveryHex, 'recovery-wrapped');
      expect(crypto.getMasterKey).toHaveBeenCalled();
      expect(crypto.deriveWrappingKeyFromRecovery).toHaveBeenCalledWith(recoveryHex);
      expect(api.patch).toHaveBeenCalledTimes(1);
      expect(api.patch).toHaveBeenCalledWith(
        '/auth/me/encryption-keys',
        expect.objectContaining({
          salt: expect.any(String),
          wrappedMasterKey: 'wrapped',
          recoveryWrappedKey: 'wrapped',
        }),
      );
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(cmp.step()).toBe('done');
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('échec du déchiffrement (mauvaise clé) → erreur invalidRecoveryKey, pas de PATCH ni logout', async () => {
      const apiPatch = vi.fn(() => of(undefined));
      const { cmp, auth, api } = makeComponent({
        keyMaterial: { recoveryWrappedKey: 'recovery-wrapped' },
        crypto: { unlockWithRecovery: vi.fn(() => Promise.reject(new Error('bad key'))) },
        apiPatch,
      });
      setRecoveryKey(cmp, 'a'.repeat(64));

      await expect(cmp.recoverWithKey()).resolves.toBeUndefined();

      expect(api.patch).not.toHaveBeenCalled();
      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.error()).toBe('auth.forgot.errors.invalidRecoveryKey');
      expect(cmp.step()).toBe('email');
      expect(cmp.loading()).toBe(false);
    });

    it('échec du PATCH serveur → erreur invalidRecoveryKey (catch englobant), pas de logout', async () => {
      const { cmp, auth } = makeComponent({
        keyMaterial: { recoveryWrappedKey: 'recovery-wrapped' },
        apiPatch: () => throwError(() => new Error('500')),
      });
      setRecoveryKey(cmp, 'a'.repeat(64));

      await cmp.recoverWithKey();

      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.error()).toBe('auth.forgot.errors.invalidRecoveryKey');
      expect(cmp.loading()).toBe(false);
    });
  });

  describe('skipRecovery — confirmation native + wipe chiffrement', () => {
    it('confirm refusé → return immédiat, aucun appel API', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { cmp, api, auth } = makeComponent();

      await cmp.skipRecovery();

      expect(api.post).not.toHaveBeenCalled();
      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
      confirmSpy.mockRestore();
    });

    it('confirm accepté → POST wipe-encryption, logout puis étape done', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { cmp, api, auth } = makeComponent();

      await cmp.skipRecovery();

      expect(api.post).toHaveBeenCalledWith('/auth/me/wipe-encryption', {});
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(cmp.step()).toBe('done');
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
      confirmSpy.mockRestore();
    });

    it('confirm accepté mais wipe échoue → erreur wipeFailed, pas de logout', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { cmp, auth } = makeComponent({
        apiPost: () => throwError(() => new Error('boom')),
      });

      await expect(cmp.skipRecovery()).resolves.toBeUndefined();

      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.error()).toBe('auth.forgot.errors.wipeFailed');
      expect(cmp.loading()).toBe(false);
      confirmSpy.mockRestore();
    });
  });
});
