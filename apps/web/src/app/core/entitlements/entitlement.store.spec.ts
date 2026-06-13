import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { EntitlementStore } from './entitlement.store';
import { anEntitlement } from './entitlement.builder';

const URL = `${environment.apiUrl}/me/entitlements`;

describe('EntitlementStore', () => {
  let store: EntitlementStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EntitlementStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(EntitlementStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('état initial (avant chargement)', () => {
    it('isLoaded est faux', () => {
      expect(store.isLoaded()).toBe(false);
    });

    it('entitlement et planKey sont null', () => {
      expect(store.entitlement()).toBeNull();
      expect(store.planKey()).toBeNull();
    });

    it('can() renvoie false pour toute feature avant chargement (dégradation fermé)', () => {
      expect(store.can('medical.access')).toBe(false);
      expect(store.can('budget.import')).toBe(false);
    });

    it('limitOf() renvoie null avant chargement', () => {
      expect(store.limitOf('bankAccounts')).toBeNull();
      expect(store.limitOf('storageBytes')).toBeNull();
    });
  });

  describe('load()', () => {
    it('appelle GET /me/entitlements et hydrate isLoaded + entitlement + planKey', async () => {
      const promise = store.load();
      httpMock
        .expectOne({ method: 'GET', url: URL })
        .flush(anEntitlement({ planKey: 'family_health' }));
      await promise;

      expect(store.isLoaded()).toBe(true);
      expect(store.planKey()).toBe('family_health');
      expect(store.entitlement()).not.toBeNull();
    });

    it('can(feature) est vrai ssi la réponse contient la feature', async () => {
      const promise = store.load();
      httpMock.expectOne(URL).flush(
        anEntitlement({
          planKey: 'family_health',
          features: ['budget.import', 'medical.access'],
        }),
      );
      await promise;

      expect(store.can('medical.access')).toBe(true);
      expect(store.can('budget.import')).toBe(true);
      expect(store.can('budget.advanced')).toBe(false);
      expect(store.can('family.sharing')).toBe(false);
    });

    it('un plan solo ne donne pas accès à medical.access', async () => {
      const promise = store.load();
      httpMock
        .expectOne(URL)
        .flush(anEntitlement({ planKey: 'solo', features: ['budget.import'] }));
      await promise;

      expect(store.can('medical.access')).toBe(false);
    });

    it('expose les limites du plan via limitOf()', async () => {
      const promise = store.load();
      httpMock
        .expectOne(URL)
        .flush(anEntitlement({ limits: { bankAccounts: 5, members: null, storageBytes: 42 } }));
      await promise;

      expect(store.limitOf('bankAccounts')).toBe(5);
      expect(store.limitOf('members')).toBeNull();
      expect(store.limitOf('storageBytes')).toBe(42);
    });

    it('filtre les features inconnues du catalogue front (ne pas élargir le type au runtime)', async () => {
      const promise = store.load();
      httpMock.expectOne(URL).flush({
        planKey: 'family_health',
        features: ['medical.access', 'unknown.feature', 'budget.import'],
        limits: { bankAccounts: null, members: null, storageBytes: 0 },
      });
      await promise;

      expect(store.entitlement()?.features).toEqual(['medical.access', 'budget.import']);
      expect(store.can('medical.access')).toBe(true);
    });

    it('idempotence : deux load() concurrents ne déclenchent qu’UNE seule requête HTTP', async () => {
      const p1 = store.load();
      const p2 = store.load();

      const req = httpMock.expectOne(URL);
      req.flush(anEntitlement());

      await Promise.all([p1, p2]);
      expect(store.isLoaded()).toBe(true);
    });

    it('idempotence : un load() après chargement ne refait PAS l’appel', async () => {
      const p1 = store.load();
      httpMock.expectOne(URL).flush(anEntitlement());
      await p1;

      await store.load();
      expect(store.isLoaded()).toBe(true);
    });
  });

  describe('dégradation « fermé » après échec', () => {
    it('un échec réseau laisse isLoaded faux et can() faux', async () => {
      const promise = store.load();
      httpMock
        .expectOne(URL)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      await promise;

      expect(store.isLoaded()).toBe(false);
      expect(store.entitlement()).toBeNull();
      expect(store.can('medical.access')).toBe(false);
    });

    it('un load() après échec retente effectivement l’appel', async () => {
      const p1 = store.load();
      httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
      await p1;

      const p2 = store.load();
      httpMock.expectOne(URL).flush(anEntitlement({ planKey: 'family' }));
      await p2;

      expect(store.isLoaded()).toBe(true);
      expect(store.planKey()).toBe('family');
    });
  });

  describe('reload()', () => {
    it('force un nouvel appel HTTP même si déjà chargé', async () => {
      const p1 = store.load();
      httpMock.expectOne(URL).flush(anEntitlement({ planKey: 'solo' }));
      await p1;

      const p2 = store.reload();
      httpMock.expectOne(URL).flush(anEntitlement({ planKey: 'family_health' }));
      await p2;

      expect(store.planKey()).toBe('family_health');
    });
  });

  describe('reset()', () => {
    it('repasse isLoaded à false et vide l’entitlement', async () => {
      const p1 = store.load();
      httpMock.expectOne(URL).flush(anEntitlement());
      await p1;
      expect(store.isLoaded()).toBe(true);

      store.reset();

      expect(store.isLoaded()).toBe(false);
      expect(store.entitlement()).toBeNull();
      expect(store.planKey()).toBeNull();
      expect(store.can('medical.access')).toBe(false);
    });

    it('après reset, un nouveau load() ré-émet la requête', async () => {
      const p1 = store.load();
      httpMock.expectOne(URL).flush(anEntitlement());
      await p1;

      store.reset();

      const p2 = store.load();
      httpMock.expectOne(URL).flush(anEntitlement({ planKey: 'family' }));
      await p2;

      expect(store.planKey()).toBe('family');
    });
  });
});
