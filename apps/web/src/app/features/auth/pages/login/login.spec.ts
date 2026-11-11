import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { AuthStore } from '../../auth.store';
import { Toaster } from '@shared/components/toast/toast';
import { isSecondFactorCode, Login } from './login';

type Cmp = {
  submitLogin: () => Promise<void>;
  submitTotp: () => Promise<void>;
  backToCredentials: () => void;
  loading: () => boolean;
  error: () => string;
  step: () => 'credentials' | 'totp';
  totpValue: { set: (v: string) => void };
  form: { setValue: (v: { email: string; password: string }) => void };
};

type AuthStoreMock = {
  needsEncryptionSetup: () => boolean;
  needsUnlock: () => boolean;
  login: ReturnType<typeof vi.fn>;
  hydrateFromCookie: ReturnType<typeof vi.fn>;
  completeOAuthLogin: ReturnType<typeof vi.fn>;
  lastBackupCodesRemaining: () => number | null;
};

function makeComponent(
  opts: {
    login?: (
      email: string,
      password: string,
      totpCode?: string,
    ) => Promise<'authenticated' | 'mfa_required'>;
    hydrateFromCookie?: () => Promise<void>;
    completeOAuthLogin?: (totpCode: string) => Promise<void>;
    needsEncryptionSetup?: boolean;
    needsUnlock?: boolean;
    queryParams?: Record<string, string>;
    lastBackupCodesRemaining?: number | null;
  } = {},
) {
  const auth: AuthStoreMock = {
    needsEncryptionSetup: () => opts.needsEncryptionSetup ?? false,
    needsUnlock: () => opts.needsUnlock ?? false,
    login: vi.fn(opts.login ?? (() => Promise.resolve('authenticated'))),
    hydrateFromCookie: vi.fn(opts.hydrateFromCookie ?? (() => Promise.resolve())),
    completeOAuthLogin: vi.fn(opts.completeOAuthLogin ?? (() => Promise.resolve())),
    lastBackupCodesRemaining: () => opts.lastBackupCodesRemaining ?? null,
  };
  const navigate = vi.fn();
  const success = vi.fn();
  const info = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: Router, useValue: { navigate } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParams: opts.queryParams ?? {} } },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
      { provide: Toaster, useValue: { success, info } },
    ],
  });
  TestBed.overrideComponent(Login, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Login);
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    auth,
    navigate,
    success,
    info,
  };
}

const VALID = { email: 'user@dash.flow', password: 'longenoughpass' };

describe('Login : authentification 2 étapes (sécurité)', () => {
  it('connexion réussie sans MFA, utilisateur prêt → navigue vers /budget', async () => {
    const { cmp, auth, navigate, success } = makeComponent();
    cmp.form.setValue(VALID);

    await cmp.submitLogin();

    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(auth.login).toHaveBeenCalledWith(VALID.email, VALID.password);
    expect(navigate).toHaveBeenCalledWith(['/budget'], { replaceUrl: true });
    expect(success).toHaveBeenCalledWith('auth.login.success');
    expect(cmp.step()).toBe('credentials');
    expect(cmp.error()).toBe('');
    expect(cmp.loading()).toBe(false);
  });

  it('connexion réussie, chiffrement à configurer → navigue vers /auth/onboarding', async () => {
    const { cmp, navigate } = makeComponent({ needsEncryptionSetup: true });
    cmp.form.setValue(VALID);

    await cmp.submitLogin();

    expect(navigate).toHaveBeenCalledWith(['/auth/onboarding'], { replaceUrl: true });
  });

  it('connexion réussie, déverrouillage requis → navigue vers /auth/unlock', async () => {
    const { cmp, navigate } = makeComponent({ needsUnlock: true });
    cmp.form.setValue(VALID);

    await cmp.submitLogin();

    expect(navigate).toHaveBeenCalledWith(['/auth/unlock'], { replaceUrl: true });
  });

  it('login retourne "mfa_required" → passe à l\'étape totp sans naviguer', async () => {
    const { cmp, navigate, success } = makeComponent({
      login: () => Promise.resolve('mfa_required'),
    });
    cmp.form.setValue(VALID);

    await cmp.submitLogin();

    expect(cmp.step()).toBe('totp');
    expect(navigate).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('');
    expect(cmp.loading()).toBe(false);
  });

  it('soumission TOTP réussie → appelle login avec le code puis navigue vers /budget', async () => {
    const { cmp, auth, navigate } = makeComponent({
      login: () => Promise.resolve('mfa_required'),
    });
    cmp.form.setValue(VALID);
    await cmp.submitLogin(); // passe en step totp
    auth.login.mockResolvedValue('authenticated');
    cmp.totpValue.set('123456');

    await cmp.submitTotp();

    expect(auth.login).toHaveBeenLastCalledWith(VALID.email, VALID.password, '123456');
    expect(navigate).toHaveBeenCalledWith(['/budget'], { replaceUrl: true });
    expect(cmp.error()).toBe('');
    expect(cmp.loading()).toBe(false);
  });

  it('TOTP invalide → erreur invalidTotp, pas de navigation, loading reset', async () => {
    const { cmp, navigate } = makeComponent({
      login: (_e, _p, code) =>
        code ? Promise.reject(new Error('bad code')) : Promise.resolve('mfa_required'),
    });
    cmp.form.setValue(VALID);
    await cmp.submitLogin();
    cmp.totpValue.set('000000');

    await expect(cmp.submitTotp()).resolves.toBeUndefined();

    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('auth.login.errors.invalidTotp');
    expect(cmp.loading()).toBe(false);
    expect(cmp.step()).toBe('totp');
  });

  it('TOTP de longueur != 6 → ne tente pas de login', async () => {
    const { cmp, auth } = makeComponent({
      login: () => Promise.resolve('mfa_required'),
    });
    cmp.form.setValue(VALID);
    await cmp.submitLogin();
    auth.login.mockClear();
    cmp.totpValue.set('123');

    await cmp.submitTotp();

    expect(auth.login).not.toHaveBeenCalled();
  });

  it('identifiants invalides → erreur invalidCredentials, pas de navigation, loading reset', async () => {
    const { cmp, navigate } = makeComponent({
      login: () => Promise.reject(new Error('401')),
    });
    cmp.form.setValue(VALID);

    await expect(cmp.submitLogin()).resolves.toBeUndefined();

    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('auth.login.errors.invalidCredentials');
    expect(cmp.loading()).toBe(false);
    expect(cmp.step()).toBe('credentials');
  });

  it('erreur EMAIL_NOT_VERIFIED → redirige vers /auth/register avec email + verify', async () => {
    const err = Object.assign(new Error('not verified'), { code: 'EMAIL_NOT_VERIFIED' });
    const { cmp, navigate } = makeComponent({
      login: () => Promise.reject(err),
    });
    cmp.form.setValue(VALID);

    await cmp.submitLogin();

    expect(navigate).toHaveBeenCalledWith(['/auth/register'], {
      queryParams: { email: VALID.email, verify: true },
    });
    expect(cmp.error()).toBe('');
    expect(cmp.loading()).toBe(false);
  });

  it('formulaire invalide (email vide) → ne tente pas de login', async () => {
    const { cmp, auth, navigate } = makeComponent();
    cmp.form.setValue({ email: '', password: VALID.password });

    await cmp.submitLogin();

    expect(auth.login).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.loading()).toBe(false);
  });

  it("backToCredentials → revient à credentials et réinitialise le code et l'erreur", async () => {
    const { cmp } = makeComponent({
      login: () => Promise.resolve('mfa_required'),
    });
    cmp.form.setValue(VALID);
    await cmp.submitLogin();
    expect(cmp.step()).toBe('totp');

    cmp.backToCredentials();

    expect(cmp.step()).toBe('credentials');
    expect(cmp.error()).toBe('');
  });

  describe('callback OAuth (constructeur)', () => {
    it('queryParam error=oauth_failed → affiche le message dédié sans hydrater', () => {
      const { cmp, auth, navigate } = makeComponent({
        queryParams: { error: 'oauth_failed' },
      });

      expect(cmp.error()).toBe('auth.login.errors.oauthFailed');
      expect(auth.hydrateFromCookie).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('queryParam error inconnu → message générique oauthGeneric', () => {
      const { cmp } = makeComponent({ queryParams: { error: 'something_else' } });

      expect(cmp.error()).toBe('auth.login.errors.oauthGeneric');
    });

    it('queryParam oauth=success → hydrate depuis le cookie puis navigue vers /budget', async () => {
      let resolveHydrate: () => void = () => undefined;
      const hydrate = vi.fn(
        () =>
          new Promise<void>((r) => {
            resolveHydrate = r;
          }),
      );
      const { cmp, auth, navigate, success } = makeComponent({
        queryParams: { oauth: 'success' },
        hydrateFromCookie: hydrate,
      });

      // Le constructeur a lancé handleOAuthCallback (async) : on attend sa résolution.
      resolveHydrate();
      await Promise.resolve();
      await Promise.resolve();

      expect(auth.hydrateFromCookie).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(['/budget'], { replaceUrl: true });
      expect(success).toHaveBeenCalledWith('auth.login.success');
      expect(cmp.loading()).toBe(false);
    });

    it('queryParam oauth=success mais hydratation échoue → erreur oauthGeneric, pas de navigation', async () => {
      const { cmp, navigate } = makeComponent({
        queryParams: { oauth: 'success' },
        hydrateFromCookie: () => Promise.reject(new Error('no cookie')),
      });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(cmp.error()).toBe('auth.login.errors.oauthGeneric');
      expect(navigate).not.toHaveBeenCalled();
      expect(cmp.loading()).toBe(false);
    });
  });
});

describe('Login : retour Google sur un compte protégé par la 2FA (?oauth=mfa)', () => {
  const PENDING = { queryParams: { oauth: 'mfa' } };

  it('affiche l’étape du code sans ouvrir de session ni naviguer', () => {
    const { cmp, auth, navigate, success } = makeComponent(PENDING);

    expect(cmp.step()).toBe('totp');
    expect(auth.hydrateFromCookie).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('');
  });

  it('code valide → termine la connexion Google (jamais le login par mot de passe) puis /budget', async () => {
    const { cmp, auth, navigate, success } = makeComponent(PENDING);
    cmp.totpValue.set('123456');

    await cmp.submitTotp();

    expect(auth.completeOAuthLogin).toHaveBeenCalledTimes(1);
    expect(auth.completeOAuthLogin).toHaveBeenCalledWith('123456');
    expect(auth.login).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/budget'], { replaceUrl: true });
    expect(success).toHaveBeenCalledWith('auth.login.success');
    expect(cmp.loading()).toBe(false);
  });

  it('code valide, compte chiffré verrouillé → /auth/unlock, comme un retour Google sans 2FA', async () => {
    const { cmp, auth, navigate } = makeComponent({ ...PENDING, needsUnlock: true });
    cmp.totpValue.set('123456');

    await cmp.submitTotp();

    expect(auth.completeOAuthLogin).toHaveBeenCalledWith('123456');
    expect(navigate).toHaveBeenCalledWith(['/auth/unlock'], { replaceUrl: true });
  });

  it('code valide, chiffrement à configurer → /auth/onboarding', async () => {
    const { cmp, auth, navigate } = makeComponent({ ...PENDING, needsEncryptionSetup: true });
    cmp.totpValue.set('123456');

    await cmp.submitTotp();

    expect(auth.completeOAuthLogin).toHaveBeenCalledWith('123456');
    expect(navigate).toHaveBeenCalledWith(['/auth/onboarding'], { replaceUrl: true });
  });

  it('code faux → erreur invalidTotp, reste sur l’étape du code, pas de navigation', async () => {
    const { cmp, navigate } = makeComponent({
      ...PENDING,
      completeOAuthLogin: () => Promise.reject(new Error('Code 2FA invalide')),
    });
    cmp.totpValue.set('000000');

    await expect(cmp.submitTotp()).resolves.toBeUndefined();

    expect(cmp.error()).toBe('auth.login.errors.invalidTotp');
    expect(cmp.step()).toBe('totp');
    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.loading()).toBe(false);
  });

  it('preuve expirée (MFA_PROOF_REJECTED) → retour aux identifiants, message oauthExpired, URL nettoyée', async () => {
    const expired = Object.assign(new Error('Connexion expirée'), { code: 'MFA_PROOF_REJECTED' });
    const { cmp, navigate } = makeComponent({
      ...PENDING,
      completeOAuthLogin: () => Promise.reject(expired),
    });
    cmp.totpValue.set('123456');

    await cmp.submitTotp();

    expect(cmp.step()).toBe('credentials');
    expect(cmp.error()).toBe('auth.login.errors.oauthExpired');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { replaceUrl: true });
  });

  it('code de secours → toast info avec le nombre restant', async () => {
    const { cmp, auth, info } = makeComponent({ ...PENDING, lastBackupCodesRemaining: 4 });
    cmp.totpValue.set('abcde-fghjk');

    await cmp.submitTotp();

    expect(auth.completeOAuthLogin).toHaveBeenCalledWith('abcde-fghjk');
    expect(info).toHaveBeenCalledWith('auth.login.backupCodeUsed', { count: 4 });
  });

  it('« Retour » abandonne l’attente : URL nettoyée, et le code suivant repart sur le login par mot de passe', async () => {
    const { cmp, auth, navigate } = makeComponent({
      ...PENDING,
      login: () => Promise.resolve('mfa_required'),
    });

    cmp.backToCredentials();
    cmp.form.setValue(VALID);
    await cmp.submitLogin();
    cmp.totpValue.set('123456');
    await cmp.submitTotp();

    expect(navigate).toHaveBeenNthCalledWith(1, ['/auth/login'], { replaceUrl: true });
    expect(auth.completeOAuthLogin).not.toHaveBeenCalled();
    expect(auth.login).toHaveBeenLastCalledWith(VALID.email, VALID.password, '123456');
  });

  it('login par mot de passe : « Retour » ne touche pas à l’URL', async () => {
    const { cmp, navigate } = makeComponent({ login: () => Promise.resolve('mfa_required') });
    cmp.form.setValue(VALID);
    await cmp.submitLogin();

    cmp.backToCredentials();

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('Login : rendu réel du template (F014)', () => {
  function mountReal(
    opts: {
      login?: (
        email: string,
        password: string,
        totpCode?: string,
      ) => Promise<'authenticated' | 'mfa_required'>;
      queryParams?: Record<string, string>;
    } = {},
  ) {
    const auth: AuthStoreMock = {
      needsEncryptionSetup: () => false,
      needsUnlock: () => false,
      login: vi.fn(opts.login ?? (() => Promise.resolve('authenticated'))),
      hydrateFromCookie: vi.fn(() => Promise.resolve()),
      completeOAuthLogin: vi.fn(() => Promise.resolve()),
      lastBackupCodesRemaining: () => null,
    };
    TestBed.configureTestingModule({
      imports: [
        Login,
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: opts.queryParams ?? {} } },
        },
        { provide: Toaster, useValue: { success: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance as unknown as Cmp, auth };
  }

  it("étape 'credentials' : le bouton de connexion est désactivé tant que le formulaire est invalide", () => {
    const { fixture } = mountReal();

    const submit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="login-submit"]',
    );

    expect(submit).not.toBeNull();
    expect(submit?.disabled).toBe(true);
  });

  it("étape 'credentials' : le bouton de connexion se réactive une fois le formulaire valide", () => {
    const { fixture, cmp } = mountReal();
    cmp.form.setValue(VALID);

    fixture.detectChanges();
    const submit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="login-submit"]',
    );

    expect(submit?.disabled).toBe(false);
  });

  it("connexion MFA requise : bascule sur l'étape 'totp' rendue dans le DOM", async () => {
    const { fixture, cmp } = mountReal({ login: () => Promise.resolve('mfa_required') });
    cmp.form.setValue(VALID);

    await cmp.submitLogin();
    fixture.detectChanges();

    const totpStep = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="login-totp-step"]',
    );
    expect(totpStep).not.toBeNull();
  });

  it("retour Google en attente du second facteur (?oauth=mfa) : l'étape 'totp' est rendue, pas le formulaire d'identifiants", () => {
    const { fixture } = mountReal({ queryParams: { oauth: 'mfa' } });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="login-totp-step"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="login-submit"]')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('#totp')?.autocomplete).toBe('one-time-code');
  });

  it('isSecondFactorCode : 6 chiffres ou code de secours (casse, tiret, espace libres)', () => {
    expect(isSecondFactorCode('123456')).toBe(true);
    expect(isSecondFactorCode('abcde-fghjk')).toBe(true);
    expect(isSecondFactorCode('ABCDE FGHJK')).toBe(true);
    expect(isSecondFactorCode('abcdefghjk')).toBe(true);
    expect(isSecondFactorCode('12345')).toBe(false);
    expect(isSecondFactorCode('abc-de')).toBe(false);
    expect(isSecondFactorCode('')).toBe(false);
  });

  it('connexion par code de secours → toast info avec le nombre restant', async () => {
    const { cmp, info } = makeComponent({
      login: (_e, _p, code) => Promise.resolve(code ? 'authenticated' : 'mfa_required'),
      lastBackupCodesRemaining: 9,
    });
    cmp.form.setValue({ email: 'a@b.com', password: 'motdepasse-long-12' });
    await cmp.submitLogin();
    cmp.totpValue.set('abcde-fghjk');
    await cmp.submitTotp();
    expect(info).toHaveBeenCalledWith('auth.login.backupCodeUsed', { count: 9 });
  });
});
