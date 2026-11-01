import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { EncryptionPassphraseModal } from './encryption-passphrase-modal';

type Cmp = {
  form: {
    setValue: (v: { passphrase: string; confirm: string }) => void;
    getRawValue: () => { passphrase: string; confirm: string };
  };
  submit: () => void;
  open: () => void;
};

function mount() {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };

  TestBed.configureTestingModule({
    imports: [
      EncryptionPassphraseModal,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(EncryptionPassphraseModal);
  fixture.detectChanges();
  return {
    cmp: fixture.componentInstance,
    protectedCmp: fixture.componentInstance as unknown as Cmp,
  };
}

const VALID = { passphrase: 'phrase-secrete-123', confirm: 'phrase-secrete-123' };

describe('EncryptionPassphraseModal', () => {
  it('given un formulaire valide (12+ caractères, confirmation identique), when submit, then émet passphraseSet avec la passphrase', () => {
    const { cmp, protectedCmp } = mount();
    const passphraseSet = vi.fn();
    cmp.passphraseSet.subscribe(passphraseSet);
    protectedCmp.form.setValue(VALID);

    protectedCmp.submit();

    expect(passphraseSet).toHaveBeenCalledWith(VALID.passphrase);
  });

  it('given une passphrase trop courte (< 12 caractères), when submit, then n’émet rien', () => {
    const { cmp, protectedCmp } = mount();
    const passphraseSet = vi.fn();
    cmp.passphraseSet.subscribe(passphraseSet);
    protectedCmp.form.setValue({ passphrase: 'court', confirm: 'court' });

    protectedCmp.submit();

    expect(passphraseSet).not.toHaveBeenCalled();
  });

  it('given une confirmation différente de la passphrase, when submit, then n’émet rien (mismatch)', () => {
    const { cmp, protectedCmp } = mount();
    const passphraseSet = vi.fn();
    cmp.passphraseSet.subscribe(passphraseSet);
    protectedCmp.form.setValue({ passphrase: 'phrase-secrete-123', confirm: 'autre-phrase-456' });

    protectedCmp.submit();

    expect(passphraseSet).not.toHaveBeenCalled();
  });

  it('given un formulaire vide, when submit, then n’émet rien', () => {
    const { cmp, protectedCmp } = mount();
    const passphraseSet = vi.fn();
    cmp.passphraseSet.subscribe(passphraseSet);

    protectedCmp.submit();

    expect(passphraseSet).not.toHaveBeenCalled();
  });

  it('given un formulaire pré-rempli, when open, then réinitialise le formulaire', () => {
    const { protectedCmp } = mount();
    protectedCmp.form.setValue(VALID);

    protectedCmp.open();

    expect(protectedCmp.form.getRawValue()).toEqual({ passphrase: '', confirm: '' });
  });
});
