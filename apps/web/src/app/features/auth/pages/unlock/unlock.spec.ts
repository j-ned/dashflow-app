import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../domain/auth.store';
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
  unlockWithPassword: ReturnType<typeof vi.fn>;
  unlockWithRecovery: ReturnType<typeof vi.fn>;
  repairWithRecovery: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
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
    unlockWithPassword: vi.fn(opts.unlockWithPassword ?? (() => Promise.resolve())),
    unlockWithRecovery: vi.fn(opts.unlockWithRecovery ?? (() => Promise.resolve())),
    repairWithRecovery: vi.fn(opts.repairWithRecovery ?? (() => Promise.resolve())),
    logout: vi.fn(opts.logout ?? (() => Promise.resolve())),
  };
  const navigate = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: Router, useValue: { navigate } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Unlock, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Unlock);
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    auth,
    navigate,
  };
}

describe('Unlock — déverrouillage E2EE (sécurité)', () => {
  it('dérive la clé et navigue vers /budget quand le mot de passe est correct', async () => {
    const { cmp, auth, navigate } = makeComponent();
    cmp.form.setValue({ password: 'correct-horse' });

    await cmp.unlock();

    expect(auth.unlockWithPassword).toHaveBeenCalledTimes(1);
    expect(auth.unlockWithPassword).toHaveBeenCalledWith('correct-horse');
    expect(navigate).toHaveBeenCalledWith(['/budget']);
    expect(cmp.error()).toBe('');
    expect(cmp.passwordFailed()).toBe(false);
    expect(cmp.loading()).toBe(false);
  });

  it('signale l\'échec sans throw et ne navigue PAS quand le mot de passe est faux', async () => {
    const { cmp, auth, navigate } = makeComponent({
      unlockWithPassword: () => Promise.reject(new Error('bad key')),
    });
    cmp.form.setValue({ password: 'wrong' });

    await expect(cmp.unlock()).resolves.toBeUndefined();

    expect(auth.unlockWithPassword).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.passwordFailed()).toBe(true);
    expect(cmp.error()).toBe('auth.unlock.errors.wrongPassword');
    expect(cmp.loading()).toBe(false);
  });

  it('ne tente pas de déverrouiller si le formulaire est invalide (mot de passe vide)', async () => {
    const { cmp, auth, navigate } = makeComponent();
    // form vide => required invalide

    await cmp.unlock();

    expect(auth.unlockWithPassword).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.loading()).toBe(false);
  });

  it('déverrouille avec la clé de récupération en supprimant les espaces puis navigue', async () => {
    const { cmp, auth, navigate } = makeComponent();
    cmp.recoveryForm.setValue({ recoveryKey: 'ab cd\tef\n01' });

    await cmp.unlockWithRecovery();

    expect(auth.unlockWithRecovery).toHaveBeenCalledWith('abcdef01');
    expect(navigate).toHaveBeenCalledWith(['/budget']);
    expect(cmp.error()).toBe('');
  });

  it('affiche une erreur de clé de récupération invalide sans naviguer en cas d\'échec', async () => {
    const { cmp, auth, navigate } = makeComponent({
      unlockWithRecovery: () => Promise.reject(new Error('invalid')),
    });
    cmp.recoveryForm.setValue({ recoveryKey: 'deadbeef' });

    await expect(cmp.unlockWithRecovery()).resolves.toBeUndefined();

    expect(auth.unlockWithRecovery).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('auth.unlock.errors.invalidRecoveryKey');
    expect(cmp.loading()).toBe(false);
  });

  it('répare avec clé de récupération + mot de passe (espaces retirés) puis navigue', async () => {
    const { cmp, auth, navigate } = makeComponent();
    cmp.repairForm.setValue({ recoveryKey: 'de ad be ef', password: 'newpass' });

    await cmp.repair();

    expect(auth.repairWithRecovery).toHaveBeenCalledWith('deadbeef', 'newpass');
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

  it('setMode bascule le mode et réinitialise l\'erreur affichée', async () => {
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
