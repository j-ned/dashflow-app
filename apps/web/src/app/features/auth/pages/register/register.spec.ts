import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../domain/auth.store';
import { Register } from './register';

type Cmp = {
  submitRegister: () => Promise<void>;
  submitVerify: () => Promise<void>;
  resendCode: () => Promise<void>;
  backToRegister: () => void;
  loading: () => boolean;
  resending: () => boolean;
  error: () => string;
  success: () => string;
  step: () => 'register' | 'verify';
  pendingEmail: () => string;
  codeValue: { set: (v: string) => void };
  registerForm: {
    setValue: (v: {
      displayName: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) => void;
    invalid: boolean;
    errors: Record<string, unknown> | null;
  };
};

type AuthStoreMock = {
  register: ReturnType<typeof vi.fn>;
  verifyCode: ReturnType<typeof vi.fn>;
  resendCode: ReturnType<typeof vi.fn>;
};

function makeComponent(
  opts: {
    register?: (email: string, password: string, displayName?: string) => Promise<void>;
    verifyCode?: (email: string, code: string) => Promise<void>;
    resendCode?: (email: string) => Promise<void>;
    queryParams?: Record<string, string>;
  } = {},
) {
  const auth: AuthStoreMock = {
    register: vi.fn(opts.register ?? (() => Promise.resolve())),
    verifyCode: vi.fn(opts.verifyCode ?? (() => Promise.resolve())),
    resendCode: vi.fn(opts.resendCode ?? (() => Promise.resolve())),
  };
  const navigate = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: Router, useValue: { navigate } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParams: opts.queryParams ?? {} } },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Register, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Register);
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    auth,
    navigate,
  };
}

const VALID_FORM = {
  displayName: 'Alice',
  email: 'alice@dash.flow',
  password: 'sup3rs3cur3passw0rd',
  confirmPassword: 'sup3rs3cur3passw0rd',
};

describe('Register — inscription 2 étapes (sécurité)', () => {
  describe('Validateur passwordMatch', () => {
    it('mots de passe identiques → formulaire valide (pas d\'erreur mismatch)', () => {
      const { cmp } = makeComponent();
      cmp.registerForm.setValue(VALID_FORM);

      expect(cmp.registerForm.invalid).toBe(false);
      expect(cmp.registerForm.errors?.['mismatch']).toBeUndefined();
    });

    it('mots de passe différents → formulaire invalide avec erreur mismatch', () => {
      const { cmp } = makeComponent();
      cmp.registerForm.setValue({ ...VALID_FORM, confirmPassword: 'differentpassword' });

      expect(cmp.registerForm.invalid).toBe(true);
      expect(cmp.registerForm.errors?.['mismatch']).toBe(true);
    });
  });

  describe('submitRegister', () => {
    it('inscription réussie → passe à l\'étape verify et mémorise l\'email', async () => {
      const { cmp, auth, navigate } = makeComponent();
      cmp.registerForm.setValue(VALID_FORM);

      await cmp.submitRegister();

      expect(auth.register).toHaveBeenCalledTimes(1);
      expect(auth.register).toHaveBeenCalledWith(
        VALID_FORM.email,
        VALID_FORM.password,
        VALID_FORM.displayName,
      );
      expect(cmp.step()).toBe('verify');
      expect(cmp.pendingEmail()).toBe(VALID_FORM.email);
      expect(navigate).not.toHaveBeenCalled();
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('inscription réussie sans displayName → appelle register avec undefined', async () => {
      const { cmp, auth } = makeComponent();
      cmp.registerForm.setValue({ ...VALID_FORM, displayName: '' });

      await cmp.submitRegister();

      expect(auth.register).toHaveBeenCalledWith(VALID_FORM.email, VALID_FORM.password, undefined);
      expect(cmp.step()).toBe('verify');
    });

    it('échec inscription (email déjà utilisé) → erreur définie, étape reste register', async () => {
      const { cmp, auth, navigate } = makeComponent({
        register: () =>
          Promise.reject({ error: { error: 'EMAIL_ALREADY_EXISTS' } } as unknown as Error),
      });
      cmp.registerForm.setValue(VALID_FORM);

      await expect(cmp.submitRegister()).resolves.toBeUndefined();

      expect(auth.register).toHaveBeenCalledTimes(1);
      expect(cmp.step()).toBe('register');
      expect(cmp.error()).toBe('EMAIL_ALREADY_EXISTS');
      expect(navigate).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('échec inscription sans body structuré → utilise le message de fallback i18n', async () => {
      const { cmp } = makeComponent({
        register: () => Promise.reject(new Error('network error')),
      });
      cmp.registerForm.setValue(VALID_FORM);

      await cmp.submitRegister();

      expect(cmp.error()).toBe('auth.register.errors.registerFailed');
      expect(cmp.step()).toBe('register');
      expect(cmp.loading()).toBe(false);
    });

    it('formulaire invalide (email vide) → ne tente pas d\'appeler register', async () => {
      const { cmp, auth, navigate } = makeComponent();
      cmp.registerForm.setValue({ ...VALID_FORM, email: '' });

      await cmp.submitRegister();

      expect(auth.register).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });

    it('formulaire invalide (mots de passe différents) → ne tente pas d\'appeler register', async () => {
      const { cmp, auth } = makeComponent();
      cmp.registerForm.setValue({ ...VALID_FORM, confirmPassword: 'wrongpassword123' });

      await cmp.submitRegister();

      expect(auth.register).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });
  });

  describe('submitVerify', () => {
    it('code valide → appelle verifyCode puis navigue vers /budget', async () => {
      const { cmp, auth, navigate } = makeComponent();
      cmp.registerForm.setValue(VALID_FORM);
      await cmp.submitRegister(); // passe en step verify, mémorise pendingEmail

      cmp.codeValue.set('123456');
      await cmp.submitVerify();

      expect(auth.verifyCode).toHaveBeenCalledTimes(1);
      expect(auth.verifyCode).toHaveBeenCalledWith(VALID_FORM.email, '123456');
      expect(navigate).toHaveBeenCalledWith(['/budget']);
      expect(cmp.error()).toBe('');
      expect(cmp.loading()).toBe(false);
    });

    it('code invalide → erreur définie, pas de navigation, loading reset', async () => {
      const { cmp, navigate } = makeComponent({
        verifyCode: () =>
          Promise.reject({ error: { error: 'INVALID_CODE' } } as unknown as Error),
      });
      cmp.registerForm.setValue(VALID_FORM);
      await cmp.submitRegister();

      cmp.codeValue.set('000000');
      await expect(cmp.submitVerify()).resolves.toBeUndefined();

      expect(navigate).not.toHaveBeenCalled();
      expect(cmp.error()).toBe('INVALID_CODE');
      expect(cmp.loading()).toBe(false);
    });

    it('verifyCode échoue sans body structuré → fallback codeInvalid i18n', async () => {
      const { cmp, navigate } = makeComponent({
        verifyCode: () => Promise.reject(new Error('bad code')),
      });
      cmp.registerForm.setValue(VALID_FORM);
      await cmp.submitRegister();

      cmp.codeValue.set('999999');
      await cmp.submitVerify();

      expect(navigate).not.toHaveBeenCalled();
      expect(cmp.error()).toBe('auth.register.errors.codeInvalid');
      expect(cmp.loading()).toBe(false);
    });

    it('code de longueur != 6 (trim inclus) → ne tente pas verifyCode', async () => {
      const { cmp, auth } = makeComponent();
      cmp.codeValue.set('12345');

      await cmp.submitVerify();

      expect(auth.verifyCode).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });
  });

  describe('resendCode', () => {
    it('renvoi réussi → success signal défini, error vide', async () => {
      const { cmp } = makeComponent();

      await cmp.resendCode();

      expect(cmp.success()).toBe('auth.register.success.codeSent');
      expect(cmp.error()).toBe('');
      expect(cmp.resending()).toBe(false);
    });

    it('échec du renvoi → error définie, success vide', async () => {
      const { cmp } = makeComponent({
        resendCode: () => Promise.reject(new Error('rate limit')),
      });

      await expect(cmp.resendCode()).resolves.toBeUndefined();

      expect(cmp.error()).toBe('auth.register.errors.resendFailed');
      expect(cmp.success()).toBe('');
      expect(cmp.resending()).toBe(false);
    });
  });

  describe('backToRegister', () => {
    it('revient à l\'étape register et réinitialise error, success et codeValue', async () => {
      const { cmp } = makeComponent();
      cmp.registerForm.setValue(VALID_FORM);
      await cmp.submitRegister(); // passe en step verify
      cmp.codeValue.set('123456');

      cmp.backToRegister();

      expect(cmp.step()).toBe('register');
      expect(cmp.error()).toBe('');
      expect(cmp.success()).toBe('');
    });
  });

  describe('constructeur — query param verify=true', () => {
    it('verify=true + email présents → passe directement à l\'étape verify et appelle resendCode', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const { cmp, auth } = makeComponent({
        queryParams: { email: 'bob@dash.flow', verify: 'true' },
      });

      expect(cmp.step()).toBe('verify');
      expect(cmp.pendingEmail()).toBe('bob@dash.flow');
      expect(auth.resendCode).toHaveBeenCalledTimes(1);
      expect(auth.resendCode).toHaveBeenCalledWith('bob@dash.flow');

      consoleError.mockRestore();
    });

    it('sans query param verify → reste à l\'étape register, resendCode non appelé', () => {
      const { cmp, auth } = makeComponent();

      expect(cmp.step()).toBe('register');
      expect(auth.resendCode).not.toHaveBeenCalled();
    });

    it('verify=true sans email → reste à l\'étape register, resendCode non appelé', () => {
      const { cmp, auth } = makeComponent({
        queryParams: { verify: 'true' },
      });

      expect(cmp.step()).toBe('register');
      expect(auth.resendCode).not.toHaveBeenCalled();
    });
  });
});
