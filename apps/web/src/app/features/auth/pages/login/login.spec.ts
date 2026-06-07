import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../domain/auth.store';
import { Toaster } from '@shared/components/toast/toast';
import { Login } from './login';

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
};

function makeComponent(
  opts: {
    login?: (
      email: string,
      password: string,
      totpCode?: string,
    ) => Promise<'authenticated' | 'mfa_required'>;
    hydrateFromCookie?: () => Promise<void>;
    needsEncryptionSetup?: boolean;
    needsUnlock?: boolean;
    queryParams?: Record<string, string>;
  } = {},
) {
  const auth: AuthStoreMock = {
    needsEncryptionSetup: () => opts.needsEncryptionSetup ?? false,
    needsUnlock: () => opts.needsUnlock ?? false,
    login: vi.fn(opts.login ?? (() => Promise.resolve('authenticated'))),
    hydrateFromCookie: vi.fn(opts.hydrateFromCookie ?? (() => Promise.resolve())),
  };
  const navigate = vi.fn();
  const success = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: Router, useValue: { navigate } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParams: opts.queryParams ?? {} } },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
      { provide: Toaster, useValue: { success } },
    ],
  });
  TestBed.overrideComponent(Login, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Login);
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    auth,
    navigate,
    success,
  };
}

const VALID = { email: 'user@dash.flow', password: 'longenoughpass' };

describe('Login — authentification 2 étapes (sécurité)', () => {
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

  it('connexion réussie, chiffrement à configurer → navigue vers /auth/encryption-setup', async () => {
    const { cmp, navigate } = makeComponent({ needsEncryptionSetup: true });
    cmp.form.setValue(VALID);

    await cmp.submitLogin();

    expect(navigate).toHaveBeenCalledWith(['/auth/encryption-setup'], { replaceUrl: true });
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

  it('backToCredentials → revient à credentials et réinitialise le code et l\'erreur', async () => {
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

      // Le constructeur a lancé handleOAuthCallback (async) — on attend sa résolution.
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
