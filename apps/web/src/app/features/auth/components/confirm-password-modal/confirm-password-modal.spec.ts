import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmPasswordModal } from './confirm-password-modal';

type Cmp = {
  form: { setValue: (v: { password: string }) => void; getRawValue: () => { password: string } };
  showPassword: { set: (v: boolean) => void; (): boolean };
  submit: () => void;
  open: () => void;
};

function mount() {
  // jsdom n'implémente ni showModal() ni close() sur <dialog> : mêmes stubs que partout
  // ailleurs où ModalDialog/ConfirmDialog sont exercés en DOM (cf. encryption-setup.spec.ts).
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };

  TestBed.configureTestingModule({
    imports: [
      ConfirmPasswordModal,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(ConfirmPasswordModal);
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance,
    protectedCmp: fixture.componentInstance as unknown as Cmp,
  };
}

describe('ConfirmPasswordModal', () => {
  it('given un mot de passe saisi, when submit, then émet confirmed avec le mot de passe', () => {
    const { cmp, protectedCmp } = mount();
    const confirmed = vi.fn();
    cmp.confirmed.subscribe(confirmed);
    protectedCmp.form.setValue({ password: 'hunter2' });

    protectedCmp.submit();

    expect(confirmed).toHaveBeenCalledWith('hunter2');
  });

  it('given submit, when confirmed est émis, then le formulaire a déjà été réinitialisé (non-rétention du mot de passe)', () => {
    const { cmp, protectedCmp } = mount();
    let passwordAtEmitTime: string | undefined;
    cmp.confirmed.subscribe(() => {
      passwordAtEmitTime = protectedCmp.form.getRawValue().password;
    });
    protectedCmp.form.setValue({ password: 'hunter2' });

    protectedCmp.submit();

    expect(passwordAtEmitTime).toBe('');
  });

  it('given un formulaire vide (password requis), when submit, then n’émet rien', () => {
    const { cmp, protectedCmp } = mount();
    const confirmed = vi.fn();
    cmp.confirmed.subscribe(confirmed);

    protectedCmp.submit();

    expect(confirmed).not.toHaveBeenCalled();
  });

  it('given une modale ouverte avec un mot de passe saisi, when open, then réinitialise le formulaire et masque le mot de passe', () => {
    const { protectedCmp } = mount();
    protectedCmp.form.setValue({ password: 'leftover' });
    protectedCmp.showPassword.set(true);

    protectedCmp.open();

    expect(protectedCmp.form.getRawValue().password).toBe('');
    expect(protectedCmp.showPassword()).toBe(false);
  });
});
