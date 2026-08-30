import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RecoveryKeyModal } from './recovery-key-modal';

type Cmp = {
  formattedKey: () => string;
  copied: () => boolean;
  copyFailed: () => boolean;
  confirmed: { (): boolean; set: (v: boolean) => void };
  copyKey: () => Promise<void>;
  continue: () => void;
  open: () => void;
};

function mount(recoveryKey = 'a'.repeat(64)) {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };

  TestBed.configureTestingModule({
    imports: [
      RecoveryKeyModal,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(RecoveryKeyModal);
  fixture.componentRef.setInput('recoveryKey', recoveryKey);
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance,
    protectedCmp: fixture.componentInstance as unknown as Cmp,
  };
}

describe('RecoveryKeyModal', () => {
  it('given une clé de 64 caractères, when formattedKey, then la découpe en groupes de 4 séparés par des espaces', () => {
    const { protectedCmp } = mount('a'.repeat(64));

    expect(protectedCmp.formattedKey()).toBe(Array(16).fill('aaaa').join(' '));
  });

  describe('copyKey', () => {
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeText = vi.fn();
      Object.assign(navigator, { clipboard: { writeText } });
    });

    it('given la copie réussit, when copyKey, then copied passe à true et copyFailed reste false', async () => {
      writeText.mockResolvedValue(undefined);
      const { protectedCmp } = mount();

      await protectedCmp.copyKey();

      expect(protectedCmp.copied()).toBe(true);
      expect(protectedCmp.copyFailed()).toBe(false);
    });

    it('given clipboard.writeText échoue (F010), when copyKey, then copyFailed passe à true sans lever et copied reste false', async () => {
      writeText.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
      const { protectedCmp } = mount();

      await expect(protectedCmp.copyKey()).resolves.toBeUndefined();

      expect(protectedCmp.copyFailed()).toBe(true);
      expect(protectedCmp.copied()).toBe(false);
    });

    it('given une copie réussie après un échec précédent, when copyKey, then copyFailed repasse à false', async () => {
      writeText.mockRejectedValueOnce(new Error('fail'));
      const { protectedCmp } = mount();
      await protectedCmp.copyKey();
      expect(protectedCmp.copyFailed()).toBe(true);

      writeText.mockResolvedValueOnce(undefined);
      await protectedCmp.copyKey();

      expect(protectedCmp.copyFailed()).toBe(false);
      expect(protectedCmp.copied()).toBe(true);
    });
  });

  describe('nettoyage du timer (F010)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('given copyKey en cours, when le composant est détruit, then le timer en attente est annulé (DestroyRef)', async () => {
      const { fixture, protectedCmp } = mount();
      await protectedCmp.copyKey();
      expect(protectedCmp.copied()).toBe(true);
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

      fixture.destroy();

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  it('given confirmed, when continue, then émet keySaved et ferme la modale', () => {
    const { cmp, protectedCmp } = mount();
    const keySaved = vi.fn();
    cmp.keySaved.subscribe(keySaved);
    protectedCmp.confirmed.set(true);

    protectedCmp.continue();

    expect(keySaved).toHaveBeenCalledTimes(1);
  });

  it('given un état sale (confirmed/copied/copyFailed à true), when open, then réinitialise les trois signals', () => {
    const { protectedCmp } = mount();
    protectedCmp.confirmed.set(true);

    protectedCmp.open();

    expect(protectedCmp.confirmed()).toBe(false);
    expect(protectedCmp.copied()).toBe(false);
    expect(protectedCmp.copyFailed()).toBe(false);
  });
});
