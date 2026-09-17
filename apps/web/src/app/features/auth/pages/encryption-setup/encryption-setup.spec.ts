import { TestBed } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import { Router } from '@angular/router';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { AuthStore } from '../../auth.store';
import { AuthEncryptionStore } from '../../auth-encryption.store';
import { AuthUser } from '../../domain/models/auth-user.model';
import { EncryptionSetup } from './encryption-setup';

type Cmp = {
  migrateData: () => Promise<void>;
  step: () => 'init' | 'migrating' | 'done';
  error: () => string;
};

function makeComponent(
  opts: {
    get?: (path: string) => Observable<unknown>;
    migrateEncryption?: (data: unknown) => Promise<void>;
    masterKey?: CryptoKey;
  } = {},
) {
  const migrateEncryption = opts.migrateEncryption ?? vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthStore,
        useValue: { getKeyMaterial: () => null },
      },
      {
        provide: AuthEncryptionStore,
        useValue: { migrateEncryption },
      },
      {
        provide: CryptoStore,
        useValue: {
          unlock: () => Promise.resolve(),
          // Clé factice non nulle par défaut : la boucle de migration s'exécute.
          getMasterKey: () => opts.masterKey ?? ({} as CryptoKey),
        },
      },
      {
        provide: ApiClient,
        useValue: { get: opts.get ?? (() => of([])) },
      },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(EncryptionSetup, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(EncryptionSetup);
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    migrateEncryption,
  };
}

describe('EncryptionSetup : migration E2EE (F003)', () => {
  it("n'envoie PAS la migration et bloque 'done' si une table échoue à chiffrer", async () => {
    const get = (path: string) =>
      path === '/bank-accounts' ? throwError(() => new Error('boom')) : of([]);
    const { cmp, migrateEncryption } = makeComponent({ get });

    await cmp.migrateData();

    expect(migrateEncryption).not.toHaveBeenCalled();
    expect(cmp.step()).toBe('init');
    expect(cmp.error()).not.toBe('');
  });

  it("envoie la migration et atteint 'done' quand toutes les tables réussissent", async () => {
    const { cmp, migrateEncryption } = makeComponent({ get: () => of([]) });

    await cmp.migrateData();

    expect(migrateEncryption).toHaveBeenCalledTimes(1);
    expect(cmp.step()).toBe('done');
  });

  it('migre aussi account_transactions : montant/date/libellé dans le blob, FK et direction en clair', async () => {
    const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const tx = {
      id: 'tx-1',
      userId: 'u1',
      accountId: 'acc-1',
      toAccountId: null,
      direction: 'expense',
      memberId: null,
      recurringEntryId: null,
      amount: '42.50',
      date: '2026-03-01',
      category: 'Courses',
      note: 'secret',
      createdAt: '2026-03-01T10:00:00Z',
    };
    const migrateEncryption = vi.fn((_data: unknown) => Promise.resolve());
    const { cmp } = makeComponent({
      masterKey,
      migrateEncryption,
      get: (path) => (path === '/transactions/all' ? of([tx]) : of([])),
    });

    await cmp.migrateData();

    expect(cmp.step()).toBe('done');
    const data = migrateEncryption.mock.calls[0][0] as Record<
      string,
      { id: string; encryptedData: string }[]
    >;
    expect(data['accountTransactions']).toHaveLength(1);
    expect(data['accountTransactions'][0].id).toBe('tx-1');
    const blob = data['accountTransactions'][0].encryptedData;
    expect(blob).not.toContain('42.50');
    expect(blob).not.toContain('Courses');
    // La transaction est bien chiffrée avec la clé maîtresse : on la relit.
    // Blob lié à sa ligne (v2) : se déchiffre avec l'id de la transaction, pas sans.
    const { decryptEntity } = await import('@core/services/crypto/entity-crypto');
    expect(blob.startsWith('v2.')).toBe(true);
    const plain = await decryptEntity<Record<string, unknown>>(
      { id: 'tx-1', encryptedData: blob },
      masterKey,
    );
    expect(plain).toEqual({
      id: 'tx-1',
      amount: '42.50',
      date: '2026-03-01',
      category: 'Courses',
      note: 'secret',
    });
  });
});

const USER: AuthUser = {
  id: 'u1',
  email: 'a@b.c',
  displayName: null,
  avatarUrl: null,
  totpEnabled: false,
  hasPassword: true,
  authVersion: 1,
  googleLinked: false,
  encryptionVersion: 0,
  hasEncryptionPassphrase: false,
  isDemoAccount: false,
  role: 'user',
};

describe('EncryptionSetup : rendu réel (régression F008 : prompt() natif remplacé par une modale)', () => {
  it("startSetup() ouvre la modale de confirmation au lieu d'un prompt() natif", () => {
    // jsdom n'implémente pas <dialog>.showModal() du tout : on la définit pour ce test DOM,
    // même limitation que pour ConfirmDialog/ModalDialog (jamais testés en DOM ailleurs).
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };

    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        { provide: AuthStore, useValue: { user: () => USER } },
        { provide: AuthEncryptionStore, useValue: {} },
        {
          provide: CryptoStore,
          useValue: { unlock: () => Promise.resolve(), getMasterKey: () => null },
        },
        { provide: ApiClient, useValue: { get: () => of([]) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(EncryptionSetup);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[type="button"]')
      ?.click();
    fixture.detectChanges();

    // ModalDialog ne rend son contenu (`<ng-content>`) que quand `isOpen()` -- la présence du champ
    // mot de passe dans le DOM prouve que la modale (pas un prompt() natif) s'est bien ouverte.
    const passwordInput = (fixture.nativeElement as HTMLElement).querySelector(
      'input#confirm-password',
    );
    expect(passwordInput).not.toBeNull();
    expect(passwordInput?.closest('dialog')?.hasAttribute('open')).toBe(true);
  });

  it('onPasswordConfirmed() appelle setupEncryption avec le mot de passe saisi dans la modale', async () => {
    const setupEncryption = vi.fn(() => Promise.resolve('recovery-key-hex'));
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        { provide: AuthStore, useValue: { user: () => USER } },
        { provide: AuthEncryptionStore, useValue: { setupEncryption } },
        {
          provide: CryptoStore,
          useValue: { unlock: () => Promise.resolve(), getMasterKey: () => null },
        },
        { provide: ApiClient, useValue: { get: () => of([]) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(EncryptionSetup);
    fixture.detectChanges();

    await (
      fixture.componentInstance as unknown as { onPasswordConfirmed: (p: string) => Promise<void> }
    ).onPasswordConfirmed('hunter2');

    expect(setupEncryption).toHaveBeenCalledWith('hunter2');
  });
});
