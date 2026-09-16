import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { AuthStore } from '../../auth.store';
import { AuthEncryptionStore } from '../../auth-encryption.store';
import { Unlock } from './unlock';

type Cmp = {
  unlock: () => Promise<void>;
  unlockWithRecovery: () => Promise<void>;
  repair: () => Promise<void>;
  logout: () => Promise<void>;
  setMode: (mode: 'password' | 'recovery' | 'repair') => void;
  loading: () => boolean;
  error: () => string;
  passwordFailed: () => boolean;
  mode: () => 'password' | 'recovery' | 'repair';
  form: { setValue: (v: { password: string }) => void };
  recoveryForm: { setValue: (v: { recoveryKey: string }) => void };
  repairForm: { setValue: (v: { recoveryKey: string; password: string }) => void };
};

type AuthStoreMock = {
  user: () => unknown;
  logout: ReturnType<typeof vi.fn>;
};

type AuthEncryptionStoreMock = {
  unlockWithPassword: ReturnType<typeof vi.fn>;
  unlockWithRecovery: ReturnType<typeof vi.fn>;
  repairWithRecovery: ReturnType<typeof vi.fn>;
};

function makeComponent(
  opts: {
    unlockWithPassword?: (password: string) => Promise<void>;
    unlockWithRecovery?: (recoveryHex: string) => Promise<void>;
    repairWithRecovery?: (recoveryHex: string, password: string) => Promise<void>;
    logout?: () => Promise<void>;
  } = {},
) {
  const auth: AuthStoreMock = {
    user: () => null,
    logout: vi.fn(opts.logout ?? (() => Promise.resolve())),
  };
  const authEncryption: AuthEncryptionStoreMock = {
    unlockWithPassword: vi.fn(opts.unlockWithPassword ?? (() => Promise.resolve())),
    unlockWithRecovery: vi.fn(opts.unlockWithRecovery ?? (() => Promise.resolve())),
    repairWithRecovery: vi.fn(opts.repairWithRecovery ?? (() => Promise.resolve())),
  };
  const navigate = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: AuthEncryptionStore, useValue: authEncryption },
      { provide: Router, useValue: { navigate, navigateByUrl: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Unlock, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Unlock);
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    auth,
    authEncryption,
    navigate,
  };
}

describe('Unlock : déverrouillage E2EE (sécurité)', () => {
  it('dérive la clé et navigue vers /budget quand le mot de passe est correct', async () => {
    const { cmp, authEncryption, navigate } = makeComponent();
    cmp.form.setValue({ password: 'correct-horse' });

    await cmp.unlock();

    expect(authEncryption.unlockWithPassword).toHaveBeenCalledTimes(1);
    expect(authEncryption.unlockWithPassword).toHaveBeenCalledWith('correct-horse');
    expect(navigate).toHaveBeenCalledWith(['/budget']);
    expect(cmp.error()).toBe('');
    expect(cmp.passwordFailed()).toBe(false);
    expect(cmp.loading()).toBe(false);
  });

  it("signale l'échec sans throw et ne navigue PAS quand le mot de passe est faux", async () => {
    const { cmp, authEncryption, navigate } = makeComponent({
      unlockWithPassword: () => Promise.reject(new Error('bad key')),
    });
    cmp.form.setValue({ password: 'wrong' });

    await expect(cmp.unlock()).resolves.toBeUndefined();

    expect(authEncryption.unlockWithPassword).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.passwordFailed()).toBe(true);
    expect(cmp.error()).toBe('auth.unlock.errors.wrongPassword');
    expect(cmp.loading()).toBe(false);
  });

  it('ne tente pas de déverrouiller si le formulaire est invalide (mot de passe vide)', async () => {
    const { cmp, authEncryption, navigate } = makeComponent();
    // form vide => required invalide

    await cmp.unlock();

    expect(authEncryption.unlockWithPassword).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.loading()).toBe(false);
  });

  it('déverrouille avec la clé de récupération en supprimant les espaces puis navigue', async () => {
    const { cmp, authEncryption, navigate } = makeComponent();
    cmp.recoveryForm.setValue({ recoveryKey: 'ab cd\tef\n01' });

    await cmp.unlockWithRecovery();

    expect(authEncryption.unlockWithRecovery).toHaveBeenCalledWith('abcdef01');
    expect(navigate).toHaveBeenCalledWith(['/budget']);
    expect(cmp.error()).toBe('');
  });

  it("affiche une erreur de clé de récupération invalide sans naviguer en cas d'échec", async () => {
    const { cmp, authEncryption, navigate } = makeComponent({
      unlockWithRecovery: () => Promise.reject(new Error('invalid')),
    });
    cmp.recoveryForm.setValue({ recoveryKey: 'deadbeef' });

    await expect(cmp.unlockWithRecovery()).resolves.toBeUndefined();

    expect(authEncryption.unlockWithRecovery).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('auth.unlock.errors.invalidRecoveryKey');
    expect(cmp.loading()).toBe(false);
  });

  it('répare avec clé de récupération + mot de passe (espaces retirés) puis navigue', async () => {
    const { cmp, authEncryption, navigate } = makeComponent();
    cmp.repairForm.setValue({ recoveryKey: 'de ad be ef', password: 'newpass' });

    await cmp.repair();

    expect(authEncryption.repairWithRecovery).toHaveBeenCalledWith('deadbeef', 'newpass');
    expect(navigate).toHaveBeenCalledWith(['/budget']);
    expect(cmp.error()).toBe('');
  });

  it('affiche une erreur de réparation sans naviguer si repairWithRecovery échoue', async () => {
    const { cmp, navigate } = makeComponent({
      repairWithRecovery: () => Promise.reject(new Error('repair boom')),
    });
    cmp.repairForm.setValue({ recoveryKey: 'deadbeef', password: 'newpass' });

    await expect(cmp.repair()).resolves.toBeUndefined();

    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('auth.unlock.errors.repairFailed');
    expect(cmp.loading()).toBe(false);
  });

  it("setMode bascule le mode et réinitialise l'erreur affichée", async () => {
    const { cmp } = makeComponent({
      unlockWithPassword: () => Promise.reject(new Error('bad')),
    });
    cmp.form.setValue({ password: 'wrong' });
    await cmp.unlock();
    expect(cmp.error()).not.toBe('');

    cmp.setMode('repair');

    expect(cmp.mode()).toBe('repair');
    expect(cmp.error()).toBe('');
  });

  it('logout délègue à AuthStore puis redirige vers la page de login', async () => {
    const { cmp, auth, navigate } = makeComponent();

    await cmp.logout();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});

describe('Unlock : rendu réel du template (F014)', () => {
  function mountReal() {
    const auth = { user: () => null, logout: vi.fn(() => Promise.resolve()) };
    const authEncryption = {
      unlockWithPassword: vi.fn(() => Promise.resolve()),
      unlockWithRecovery: vi.fn(() => Promise.resolve()),
      repairWithRecovery: vi.fn(() => Promise.resolve()),
    };
    TestBed.configureTestingModule({
      imports: [
        Unlock,
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        { provide: AuthStore, useValue: auth },
        { provide: AuthEncryptionStore, useValue: authEncryption },
        { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
      ],
    });
    const fixture = TestBed.createComponent(Unlock);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
  }

  it("mode 'password' : le bouton de déverrouillage est désactivé tant que le mot de passe est vide", () => {
    const { fixture } = mountReal();

    const submit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="unlock-submit"]',
    );

    expect(submit).not.toBeNull();
    expect(submit?.disabled).toBe(true);
  });

  it("mode 'password' : le bouton de déverrouillage se réactive une fois le mot de passe saisi", () => {
    const { fixture, cmp } = mountReal();
    cmp.form.setValue({ password: 'correct-horse' });

    fixture.detectChanges();
    const submit = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="unlock-submit"]',
    );

    expect(submit?.disabled).toBe(false);
  });

  it("clic sur 'utiliser la clé de récupération' : bascule sur le mode 'recovery' rendu dans le DOM", () => {
    const { fixture } = mountReal();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="unlock-use-recovery-key"]')
      ?.click();
    fixture.detectChanges();

    const recoveryMode = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="unlock-recovery-mode"]',
    );
    expect(recoveryMode).not.toBeNull();
  });
});
