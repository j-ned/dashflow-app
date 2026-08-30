import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { Observable, of, throwError } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { AuthStore } from '../../auth.store';
import { AuthEncryptionStore } from '../../auth-encryption.store';
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
  mfaRequiredAfterReset: () => boolean;
  emailForm: { setValue: (v: { email: string }) => void };
  resetForm: {
    setValue: (v: { code: string; newPassword: string; confirmPassword: string }) => void;
  };
  _resetPassword: string;
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

type AuthEncryptionStoreMock = {
  repairWithRecovery: ReturnType<typeof vi.fn>;
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
    repairWithRecovery?: () => Promise<void>;
    user?: AuthUserShape | null;
    keyMaterial?: KeyMaterialShape | null;
    apiPatch?: () => Observable<unknown>;
    apiPost?: () => Observable<unknown>;
    confirmed?: boolean;
  } = {},
) {
  const confirmService = { confirm: vi.fn(() => Promise.resolve(opts.confirmed ?? true)) };
  const auth: AuthStoreMock = {
    forgotPassword: vi.fn(opts.forgotPassword ?? (() => Promise.resolve())),
    resetPassword: vi.fn(opts.resetPassword ?? (() => Promise.resolve())),
    login: vi.fn(opts.login ?? (() => Promise.resolve(undefined))),
    logout: vi.fn(opts.logout ?? (() => Promise.resolve())),
    user: () => opts.user ?? null,
    getKeyMaterial: () => opts.keyMaterial ?? null,
  };
  const authEncryption: AuthEncryptionStoreMock = {
    repairWithRecovery: vi.fn(opts.repairWithRecovery ?? (() => Promise.resolve())),
  };

  const api: ApiClientMock = {
    patch: vi.fn(opts.apiPatch ?? (() => of(undefined))),
    post: vi.fn(opts.apiPost ?? (() => of(undefined))),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: AuthEncryptionStore, useValue: authEncryption },
      { provide: ApiClient, useValue: api },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
      { provide: ConfirmService, useValue: confirmService },
    ],
  });
  TestBed.overrideComponent(ForgotPassword, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(ForgotPassword);
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    auth,
    authEncryption,
    api,
    confirmService,
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

describe('ForgotPassword : réinitialisation multi-étapes (sécurité E2EE)', () => {
  describe('submitEmail : demande de code', () => {
    it("succès → mémorise l'email et passe à l'étape reset", async () => {
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

    it("échec gateway (forme normalisée ApiClient) → erreur i18n générique, reste à l'étape email", async () => {
      const { cmp, auth } = makeComponent({
        forgotPassword: () =>
          Promise.reject({ status: 429, message: 'Too many requests', code: 'RATE_LIMITED' }),
      });
      cmp.emailForm.setValue(VALID_EMAIL);

      await expect(cmp.submitEmail()).resolves.toBeUndefined();

      expect(auth.forgotPassword).toHaveBeenCalledTimes(1);
      expect(cmp.step()).toBe('email');
      expect(cmp.error()).toBe('auth.forgot.errors.generic');
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

    it("formulaire invalide (email vide) → n'appelle pas la gateway", async () => {
      const { cmp, auth } = makeComponent();
      cmp.emailForm.setValue({ email: '' });

      await cmp.submitEmail();

      expect(auth.forgotPassword).not.toHaveBeenCalled();
      expect(cmp.step()).toBe('email');
      expect(cmp.loading()).toBe(false);
    });
  });

  describe('submitReset : soumission code + nouveau mot de passe', () => {
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

    it("reset OK, compte chiffré (encryptionVersion 1) → passe à l'étape recovery, pas de logout", async () => {
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

    it('given un compte protégé par 2FA (régression sécurité), when submitReset, then ne saute jamais silencieusement le rewrap E2EE : détecte mfa_required et redirige vers un login normal sans toucher au crypto', async () => {
      const { cmp, auth, authEncryption } = makeComponent({
        login: () => Promise.resolve('mfa_required'),
      });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);

      await cmp.submitReset();

      // Ne doit RIEN tenter côté crypto : ni passer à l'étape recovery (qui suppose une
      // session authentifiée), ni logout (aucune session n'a été ouverte par login()).
      expect(cmp.step()).toBe('done');
      expect(cmp.mfaRequiredAfterReset()).toBe(true);
      expect(auth.logout).not.toHaveBeenCalled();
      expect(authEncryption.repairWithRecovery).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('given un reset réussi sans 2FA, when submitReset, then mfaRequiredAfterReset reste false', async () => {
      const { cmp } = makeComponent({ user: { encryptionVersion: 0 } });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);

      await cmp.submitReset();

      expect(cmp.mfaRequiredAfterReset()).toBe(false);
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

    it("resetPassword échoue → erreur codeInvalid, reste à l'étape reset", async () => {
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

    it("formulaire reset invalide (mots de passe différents) → n'appelle pas resetPassword", async () => {
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
    it("revient à l'étape email et réinitialise erreur, succès et formulaire reset", async () => {
      const { cmp } = makeComponent({
        resetPassword: () => Promise.reject(new Error('bad code')),
      });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);
      await cmp.submitReset();
      expect(cmp.error()).not.toBe('');
      expect(cmp._resetPassword).toBe(VALID_RESET.newPassword);

      cmp.backToEmail();

      expect(cmp.step()).toBe('email');
      expect(cmp.error()).toBe('');
      expect(cmp.success()).toBe('');
    });

    it('given un mot de passe réinitialisé en mémoire (F018), when backToEmail, then le zéroise', async () => {
      const { cmp } = makeComponent({ user: { encryptionVersion: 1 } });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);
      await cmp.submitReset();
      expect(cmp._resetPassword).toBe(VALID_RESET.newPassword);

      cmp.backToEmail();

      expect(cmp._resetPassword).toBe('');
    });
  });

  describe('onRecoveryKeyInput : normalisation', () => {
    it('supprime tous les espaces (espaces, tabs, retours ligne) de la clé saisie', () => {
      const { cmp } = makeComponent();

      setRecoveryKey(cmp, 'ab cd\tef\n01');

      expect(cmp.recoveryKeyValue()).toBe('abcdef01');
    });
  });

  describe('recoverWithKey : délègue à authEncryption.repairWithRecovery (F007, converge sur le store)', () => {
    it('clé de longueur != 64 → return immédiat, aucun appel repairWithRecovery', async () => {
      const { cmp, auth, authEncryption } = makeComponent();
      setRecoveryKey(cmp, 'deadbeef'); // 8 chars

      await cmp.recoverWithKey();

      expect(authEncryption.repairWithRecovery).not.toHaveBeenCalled();
      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('pas de recoveryWrappedKey en mémoire → erreur noRecoveryKey, pas de repairWithRecovery', async () => {
      const { cmp, authEncryption } = makeComponent({ keyMaterial: { recoveryWrappedKey: null } });
      setRecoveryKey(cmp, 'a'.repeat(64));

      await cmp.recoverWithKey();

      expect(cmp.error()).toBe('auth.forgot.errors.noRecoveryKey');
      expect(authEncryption.repairWithRecovery).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('keyMaterial absent → erreur noRecoveryKey (optional chaining)', async () => {
      const { cmp, authEncryption } = makeComponent({ keyMaterial: null });
      setRecoveryKey(cmp, 'a'.repeat(64));

      await cmp.recoverWithKey();

      expect(cmp.error()).toBe('auth.forgot.errors.noRecoveryKey');
      expect(authEncryption.repairWithRecovery).not.toHaveBeenCalled();
    });

    it('chemin complet de récupération → repairWithRecovery(recoveryHex, motDePasseSaisi) puis logout et done', async () => {
      const { cmp, auth, authEncryption } = makeComponent({
        keyMaterial: { recoveryWrappedKey: 'recovery-wrapped' },
        user: { encryptionVersion: 1 },
      });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);
      await cmp.submitReset(); // mémorise _resetPassword et bascule sur l'étape recovery
      const recoveryHex = 'a'.repeat(64);
      setRecoveryKey(cmp, recoveryHex);

      await cmp.recoverWithKey();

      expect(authEncryption.repairWithRecovery).toHaveBeenCalledWith(
        recoveryHex,
        VALID_RESET.newPassword,
      );
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(cmp.step()).toBe('done');
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
      expect(cmp._resetPassword).toBe(''); // F018 : plus besoin du mot de passe une fois rewrap fait
    });

    it('échec côté store (mauvaise clé ou PATCH serveur) → erreur invalidRecoveryKey, pas de logout', async () => {
      const { cmp, auth } = makeComponent({
        keyMaterial: { recoveryWrappedKey: 'recovery-wrapped' },
        repairWithRecovery: vi.fn(() => Promise.reject(new Error('bad key'))),
      });
      setRecoveryKey(cmp, 'a'.repeat(64));

      await expect(cmp.recoverWithKey()).resolves.toBeUndefined();

      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.error()).toBe('auth.forgot.errors.invalidRecoveryKey');
      expect(cmp.step()).toBe('email');
      expect(cmp.loading()).toBe(false);
    });

    it('given un échec de repairWithRecovery (mauvaise clé de récupération), when recoverWithKey, then conserve _resetPassword pour permettre une nouvelle tentative', async () => {
      const { cmp } = makeComponent({
        keyMaterial: { recoveryWrappedKey: 'recovery-wrapped' },
        user: { encryptionVersion: 1 },
        repairWithRecovery: vi.fn(() => Promise.reject(new Error('bad recovery key'))),
      });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);
      await cmp.submitReset();
      setRecoveryKey(cmp, 'a'.repeat(64));

      await cmp.recoverWithKey();

      expect(cmp._resetPassword).toBe(VALID_RESET.newPassword);
    });
  });

  describe('skipRecovery : confirmation via ConfirmService (régression F008 : plus de confirm() natif) + wipe chiffrement', () => {
    it('confirmation refusée → return immédiat, aucun appel API', async () => {
      const { cmp, api, auth, confirmService } = makeComponent({ confirmed: false });

      await cmp.skipRecovery();

      expect(confirmService.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'danger' }),
      );
      expect(api.post).not.toHaveBeenCalled();
      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('confirmation acceptée → POST wipe-encryption, logout puis étape done', async () => {
      const { cmp, api, auth } = makeComponent({ confirmed: true });

      await cmp.skipRecovery();

      expect(api.post).toHaveBeenCalledWith('/auth/me/wipe-encryption', {});
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(cmp.step()).toBe('done');
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('given un mot de passe réinitialisé en mémoire (F018), when skipRecovery confirmé, then le zéroise', async () => {
      const { cmp } = makeComponent({ confirmed: true, user: { encryptionVersion: 1 } });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);
      await cmp.submitReset();
      expect(cmp._resetPassword).toBe(VALID_RESET.newPassword);

      await cmp.skipRecovery();

      expect(cmp._resetPassword).toBe('');
    });

    it('confirmation acceptée mais wipe échoue → erreur wipeFailed, pas de logout', async () => {
      const { cmp, auth } = makeComponent({
        confirmed: true,
        apiPost: () => throwError(() => new Error('boom')),
      });

      await expect(cmp.skipRecovery()).resolves.toBeUndefined();

      expect(auth.logout).not.toHaveBeenCalled();
      expect(cmp.error()).toBe('auth.forgot.errors.wipeFailed');
      expect(cmp.loading()).toBe(false);
    });
  });
});

describe('ForgotPassword : rendu réel du template (F014)', () => {
  function mountReal(opts: { forgotPassword?: (email: string) => Promise<void> } = {}) {
    const auth = {
      forgotPassword: vi.fn(opts.forgotPassword ?? (() => Promise.resolve())),
      resetPassword: vi.fn(() => Promise.resolve()),
      login: vi.fn(() => Promise.resolve(undefined)),
      logout: vi.fn(() => Promise.resolve()),
      user: () => null,
      getKeyMaterial: () => null,
    };
    const authEncryption = { repairWithRecovery: vi.fn(() => Promise.resolve()) };
    TestBed.configureTestingModule({
      imports: [
        ForgotPassword,
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: auth },
        { provide: AuthEncryptionStore, useValue: authEncryption },
        { provide: ApiClient, useValue: { patch: () => of(undefined), post: () => of(undefined) } },
      ],
    });
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
  }

  it("étape 'email' : le bouton d'envoi est désactivé tant que l'email est invalide", () => {
    const { fixture } = mountReal();

    const submit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="forgot-email-submit"]',
    );

    expect(submit).not.toBeNull();
    expect(submit?.disabled).toBe(true);
  });

  it("étape 'email' : le bouton d'envoi se réactive une fois l'email valide", () => {
    const { fixture, cmp } = mountReal();
    cmp.emailForm.setValue(VALID_EMAIL);

    fixture.detectChanges();
    const submit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="forgot-email-submit"]',
    );

    expect(submit?.disabled).toBe(false);
  });

  it("envoi réussi : bascule sur l'étape 'reset' rendue dans le DOM", async () => {
    const { fixture, cmp } = mountReal();
    cmp.emailForm.setValue(VALID_EMAIL);

    await cmp.submitEmail();
    fixture.detectChanges();

    const resetStep = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="forgot-reset-step"]',
    );
    expect(resetStep).not.toBeNull();
  });
});
