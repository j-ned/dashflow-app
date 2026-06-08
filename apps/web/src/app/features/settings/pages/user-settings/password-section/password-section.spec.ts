import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/domain/auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { Toaster } from '@shared/components/toast/toast';
import { PasswordSection } from './password-section';

function mount(
  opts: { hasPassword?: boolean; encryptionVersion?: number; isUnlocked?: boolean } = {},
) {
  const setPassword = vi.fn(() => Promise.resolve());
  const updatePassword = vi.fn(() => Promise.resolve());
  const updatePasswordWithReWrap = vi.fn(() => Promise.resolve());
  const unlockWithPassword = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    imports: [
      PasswordSection,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      {
        provide: AuthStore,
        useValue: {
          hasPassword: () => opts.hasPassword ?? true,
          encryptionVersion: () => opts.encryptionVersion ?? 0,
          setPassword,
          updatePassword,
          updatePasswordWithReWrap,
          unlockWithPassword,
        },
      },
      { provide: CryptoStore, useValue: { isUnlocked: () => opts.isUnlocked ?? true } },
      { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(PasswordSection);
  fixture.detectChanges();
  const cmp = fixture.componentInstance as unknown as {
    passwordForm: {
      setValue: (v: {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
      }) => void;
    };
    changePassword: () => Promise<void>;
  };
  const fill = (cur: string, nw: string) =>
    cmp.passwordForm.setValue({ currentPassword: cur, newPassword: nw, confirmPassword: nw });
  return {
    fixture,
    cmp,
    fill,
    setPassword,
    updatePassword,
    updatePasswordWithReWrap,
    unlockWithPassword,
  };
}

describe('PasswordSection — changePassword 3 voies', () => {
  it('voie SET : pas de mot de passe existant → auth.setPassword(new)', async () => {
    const { cmp, fill, setPassword, updatePassword } = mount({ hasPassword: false });
    fill('', 'motdepasse-123');
    await cmp.changePassword();
    expect(setPassword).toHaveBeenCalledWith('motdepasse-123');
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('voie UPDATE simple : hasPassword + encryptionVersion 0 → auth.updatePassword(cur,new)', async () => {
    const { cmp, fill, updatePassword, updatePasswordWithReWrap } = mount({
      hasPassword: true,
      encryptionVersion: 0,
    });
    fill('ancien-motdepasse', 'nouveau-motdepasse');
    await cmp.changePassword();
    expect(updatePassword).toHaveBeenCalledWith('ancien-motdepasse', 'nouveau-motdepasse');
    expect(updatePasswordWithReWrap).not.toHaveBeenCalled();
  });

  it('voie E2EE re-wrap déverrouillée : updatePasswordWithReWrap, pas d’unlock', async () => {
    const { cmp, fill, updatePasswordWithReWrap, unlockWithPassword } = mount({
      hasPassword: true,
      encryptionVersion: 1,
      isUnlocked: true,
    });
    fill('ancien-motdepasse', 'nouveau-motdepasse');
    await cmp.changePassword();
    expect(updatePasswordWithReWrap).toHaveBeenCalledWith(
      'ancien-motdepasse',
      'nouveau-motdepasse',
    );
    expect(unlockWithPassword).not.toHaveBeenCalled();
  });

  it('voie E2EE re-wrap verrouillée : unlock avec currentPassword AVANT le re-wrap', async () => {
    const { cmp, fill, updatePasswordWithReWrap, unlockWithPassword } = mount({
      hasPassword: true,
      encryptionVersion: 1,
      isUnlocked: false,
    });
    fill('ancien-motdepasse', 'nouveau-motdepasse');
    await cmp.changePassword();
    expect(unlockWithPassword).toHaveBeenCalledWith('ancien-motdepasse');
    expect(updatePasswordWithReWrap).toHaveBeenCalledWith(
      'ancien-motdepasse',
      'nouveau-motdepasse',
    );
    expect(unlockWithPassword.mock.invocationCallOrder[0]).toBeLessThan(
      updatePasswordWithReWrap.mock.invocationCallOrder[0],
    );
  });
});
