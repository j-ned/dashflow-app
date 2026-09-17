import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
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
  emailForm: { setValue: (v: { email: string }) => void };
  resetForm: {
    setValue: (v: { code: string; newPassword: string; confirmPassword: string }) => void;
  };
  _resetCode: string;
  _resetPassword: string;
  _recoveryWrappedKey: string;
};

type AuthStoreMock = {
  forgotPassword: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
};

type AuthEncryptionStoreMock = {
  resetPasswordWithRecovery: ReturnType<typeof vi.fn>;
  resetPasswordWithWipe: ReturnType<typeof vi.fn>;
};

/** Refus du reset classique par le serveur pour un compte chiffré (forme normalisée ApiClient). */
const recoveryRequired = (recoveryWrappedKey: string | null = 'recovery-wrapped') => ({
  status: 409,
  message: 'Compte chiffré : clé de récupération requise',
  code: 'E2EE_RECOVERY_REQUIRED',
  details: { recoveryWrappedKey },
});

function makeComponent(
  opts: {
    forgotPassword?: (email: string) => Promise<void>;
    resetPassword?: (email: string, code: string, newPassword: string) => Promise<void>;
    resetPasswordWithRecovery?: () => Promise<void>;
    resetPasswordWithWipe?: () => Promise<void>;
    confirmed?: boolean;
  } = {},
) {
  const confirmService = { confirm: vi.fn(() => Promise.resolve(opts.confirmed ?? true)) };
  const auth: AuthStoreMock = {
    forgotPassword: vi.fn(opts.forgotPassword ?? (() => Promise.resolve())),
    resetPassword: vi.fn(opts.resetPassword ?? (() => Promise.resolve())),
  };
  const authEncryption: AuthEncryptionStoreMock = {
    resetPasswordWithRecovery: vi.fn(opts.resetPasswordWithRecovery ?? (() => Promise.resolve())),
    resetPasswordWithWipe: vi.fn(opts.resetPasswordWithWipe ?? (() => Promise.resolve())),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: AuthEncryptionStore, useValue: authEncryption },
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
    confirmService,
  };
}

/** Amène le composant à l'étape recovery : e-mail saisi, puis reset classique refusé (409). */
async function reachRecoveryStep(cmp: Cmp): Promise<void> {
  cmp.emailForm.setValue(VALID_EMAIL);
  await cmp.submitEmail();
  cmp.resetForm.setValue(VALID_RESET);
  await cmp.submitReset();
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
    it('compte non chiffré : reset accepté → étape done, sans ouvrir de session, secrets oubliés', async () => {
      const { cmp, auth } = makeComponent();
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);

      await cmp.submitReset();

      expect(auth.resetPassword).toHaveBeenCalledWith(
        VALID_EMAIL.email,
        VALID_RESET.code,
        VALID_RESET.newPassword,
      );
      expect(cmp.step()).toBe('done');
      expect(cmp.error()).toBe('');
      expect(cmp._resetPassword).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('compte chiffré : le serveur refuse (409 E2EE_RECOVERY_REQUIRED) → étape recovery avec le blob, le code et le mot de passe gardés pour la requête unique', async () => {
      const { cmp } = makeComponent({ resetPassword: () => Promise.reject(recoveryRequired()) });

      await reachRecoveryStep(cmp);

      expect(cmp.step()).toBe('recovery');
      expect(cmp.error()).toBe('');
      expect(cmp._recoveryWrappedKey).toBe('recovery-wrapped');
      expect(cmp._resetCode).toBe(VALID_RESET.code);
      expect(cmp._resetPassword).toBe(VALID_RESET.newPassword);
      expect(cmp.loading()).toBe(false);
    });

    it.each([
      ['409 d’un autre code', { status: 409, message: 'x', code: 'AUTRE' }],
      ['400 code invalide', { status: 400, message: 'Code invalide ou expiré' }],
      ['erreur réseau', new Error('network')],
    ])("%s → erreur codeInvalid, reste à l'étape reset", async (_label, rejection) => {
      const { cmp } = makeComponent({ resetPassword: () => Promise.reject(rejection) });
      cmp.emailForm.setValue(VALID_EMAIL);
      await cmp.submitEmail();
      cmp.resetForm.setValue(VALID_RESET);

      await expect(cmp.submitReset()).resolves.toBeUndefined();

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

    it('given des secrets en mémoire à l’étape recovery (F018), when backToEmail, then les zéroise', async () => {
      const { cmp } = makeComponent({ resetPassword: () => Promise.reject(recoveryRequired()) });
      await reachRecoveryStep(cmp);
      expect(cmp._resetPassword).toBe(VALID_RESET.newPassword);

      cmp.backToEmail();

      expect(cmp._resetPassword).toBe('');
      expect(cmp._resetCode).toBe('');
      expect(cmp._recoveryWrappedKey).toBe('');
    });
  });

  describe('onRecoveryKeyInput : normalisation', () => {
    it('supprime tous les espaces (espaces, tabs, retours ligne) de la clé saisie', () => {
      const { cmp } = makeComponent();

      setRecoveryKey(cmp, 'ab cd\tef\n01');

      expect(cmp.recoveryKeyValue()).toBe('abcdef01');
    });
  });

  describe('recoverWithKey : reset et ré-emballage en une seule requête', () => {
    it('clé de longueur != 64 → return immédiat, aucun appel', async () => {
      const { cmp, authEncryption } = makeComponent();
      setRecoveryKey(cmp, 'deadbeef');

      await cmp.recoverWithKey();

      expect(authEncryption.resetPasswordWithRecovery).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('compte chiffré sans blob de récupération (409 avec null) → erreur noRecoveryKey, aucun appel', async () => {
      const { cmp, authEncryption } = makeComponent({
        resetPassword: () => Promise.reject(recoveryRequired(null)),
      });
      await reachRecoveryStep(cmp);
      expect(cmp.step()).toBe('recovery');
      setRecoveryKey(cmp, 'a'.repeat(64));

      await cmp.recoverWithKey();

      expect(cmp.error()).toBe('auth.forgot.errors.noRecoveryKey');
      expect(authEncryption.resetPasswordWithRecovery).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('chemin complet → e-mail, code, mot de passe, clé saisie et blob transmis au store, puis done et secrets oubliés', async () => {
      const { cmp, authEncryption } = makeComponent({
        resetPassword: () => Promise.reject(recoveryRequired()),
      });
      await reachRecoveryStep(cmp);
      const recoveryHex = 'a'.repeat(64);
      setRecoveryKey(cmp, recoveryHex);

      await cmp.recoverWithKey();

      expect(authEncryption.resetPasswordWithRecovery).toHaveBeenCalledWith({
        email: VALID_EMAIL.email,
        code: VALID_RESET.code,
        newPassword: VALID_RESET.newPassword,
        recoveryHex,
        recoveryWrappedKey: 'recovery-wrapped',
      });
      expect(cmp.step()).toBe('done');
      expect(cmp.error()).toBe('');
      expect(cmp._resetPassword).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it.each([
      ['mauvaise clé de récupération (erreur crypto)', new Error('bad key'), 'invalidRecoveryKey'],
      [
        'code expiré (erreur HTTP)',
        { status: 400, message: 'Code invalide ou expiré' },
        'codeInvalid',
      ],
    ])(
      '%s → erreur dédiée, reste sur recovery et garde les secrets pour réessayer',
      async (_label, rejection, errorKey) => {
        const { cmp } = makeComponent({
          resetPassword: () => Promise.reject(recoveryRequired()),
          resetPasswordWithRecovery: () => Promise.reject(rejection),
        });
        await reachRecoveryStep(cmp);
        setRecoveryKey(cmp, 'a'.repeat(64));

        await expect(cmp.recoverWithKey()).resolves.toBeUndefined();

        expect(cmp.error()).toBe(`auth.forgot.errors.${errorKey}`);
        expect(cmp.step()).toBe('recovery');
        expect(cmp._resetPassword).toBe(VALID_RESET.newPassword);
        expect(cmp.loading()).toBe(false);
      },
    );
  });

  describe('skipRecovery : confirmation via ConfirmService puis reset avec effacement', () => {
    it('confirmation refusée → return immédiat, aucun appel', async () => {
      const { cmp, authEncryption, confirmService } = makeComponent({ confirmed: false });

      await cmp.skipRecovery();

      expect(confirmService.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'danger' }),
      );
      expect(authEncryption.resetPasswordWithWipe).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('confirmation acceptée → reset avec effacement (e-mail, code, mot de passe), done et secrets oubliés', async () => {
      const { cmp, authEncryption } = makeComponent({
        confirmed: true,
        resetPassword: () => Promise.reject(recoveryRequired()),
      });
      await reachRecoveryStep(cmp);

      await cmp.skipRecovery();

      expect(authEncryption.resetPasswordWithWipe).toHaveBeenCalledWith(
        VALID_EMAIL.email,
        VALID_RESET.code,
        VALID_RESET.newPassword,
      );
      expect(cmp.step()).toBe('done');
      expect(cmp._resetPassword).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('effacement refusé par le serveur → erreur wipeFailed, reste sur recovery avec ses secrets', async () => {
      const { cmp } = makeComponent({
        confirmed: true,
        resetPassword: () => Promise.reject(recoveryRequired()),
        resetPasswordWithWipe: () => Promise.reject(new Error('boom')),
      });
      await reachRecoveryStep(cmp);

      await expect(cmp.skipRecovery()).resolves.toBeUndefined();

      expect(cmp.error()).toBe('auth.forgot.errors.wipeFailed');
      expect(cmp.step()).toBe('recovery');
      expect(cmp._resetPassword).toBe(VALID_RESET.newPassword);
      expect(cmp.loading()).toBe(false);
    });
  });
});

describe('ForgotPassword : rendu réel du template (F014)', () => {
  function mountReal(opts: { forgotPassword?: (email: string) => Promise<void> } = {}) {
    const auth = {
      forgotPassword: vi.fn(opts.forgotPassword ?? (() => Promise.resolve())),
      resetPassword: vi.fn(() => Promise.resolve()),
    };
    const authEncryption = {
      resetPasswordWithRecovery: vi.fn(() => Promise.resolve()),
      resetPasswordWithWipe: vi.fn(() => Promise.resolve()),
    };
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
