import { TestBed } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { AuthStore } from '../../domain/auth.store';
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
  } = {},
) {
  const migrateEncryption = opts.migrateEncryption ?? vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthStore,
        useValue: {
          getKeyMaterial: () => null,
          migrateEncryption,
        },
      },
      {
        provide: CryptoStore,
        useValue: {
          unlock: () => Promise.resolve(),
          // Clé factice non nulle : la boucle de migration s'exécute.
          getMasterKey: () => ({}) as CryptoKey,
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

describe('EncryptionSetup — migration E2EE (F003)', () => {
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
});
