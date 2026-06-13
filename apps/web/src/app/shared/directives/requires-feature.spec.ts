import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RequiresFeature } from './requires-feature';
import { EntitlementStore } from '@core/entitlements/entitlement.store';
import type { Feature } from '@core/entitlements/entitlement.types';

@Component({
  selector: 'app-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RequiresFeature],
  template: `
    <div *appRequiresFeature="feature()">
      <span data-testid="unlocked-content">Importer CSV</span>
    </div>
  `,
})
class Host {
  readonly feature = signal<Feature>('budget.import');
}

describe('RequiresFeature directive (*appRequiresFeature)', () => {
  let granted: WritableSignal<ReadonlySet<Feature>>;

  beforeEach(() => {
    granted = signal<ReadonlySet<Feature>>(new Set());
    const storeMock = {
      can: (f: Feature) => granted().has(f),
      isLoaded: () => granted().size > 0,
    };

    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { fr: {}, en: {} },
          translocoConfig: { availableLangs: ['fr', 'en'], defaultLang: 'fr' },
        }),
      ],
      providers: [provideRouter([]), { provide: EntitlementStore, useValue: storeMock }],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture;
  }

  function content(fixture: ReturnType<typeof render>): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="unlocked-content"]');
  }

  function badge(fixture: ReturnType<typeof render>): HTMLElement | null {
    return fixture.nativeElement.querySelector('app-locked-badge');
  }

  function disabledWrapper(fixture: ReturnType<typeof render>): HTMLElement | null {
    return fixture.nativeElement.querySelector('[aria-disabled="true"]');
  }

  describe('quand la feature est accordée', () => {
    beforeEach(() => granted.set(new Set<Feature>(['budget.import'])));

    it('rend le contenu nominal normalement', () => {
      const fixture = render();
      expect(content(fixture)).not.toBeNull();
    });

    it('n’affiche aucun badge de verrouillage', () => {
      const fixture = render();
      expect(badge(fixture)).toBeNull();
    });

    it('n’applique aucun grisage (pas d’aria-disabled ni opacity/pointer-events)', () => {
      const fixture = render();
      expect(disabledWrapper(fixture)).toBeNull();

      const html = fixture.nativeElement.innerHTML as string;
      expect(html).not.toContain('opacity-50');
      expect(html).not.toContain('pointer-events-none');
    });
  });

  describe('quand la feature est absente (verrou doux — pas de masquage total)', () => {
    beforeEach(() => granted.set(new Set()));

    it('garde le contenu nominal rendu dans le DOM', () => {
      const fixture = render();
      expect(content(fixture)).not.toBeNull();
    });

    it('grise/désactive le contenu via un wrapper aria-disabled + opacity-50 pointer-events-none', () => {
      const fixture = render();

      const wrapper = disabledWrapper(fixture);
      expect(wrapper).not.toBeNull();
      expect(wrapper?.classList.contains('opacity-50')).toBe(true);
      expect(wrapper?.classList.contains('pointer-events-none')).toBe(true);
      expect(wrapper?.contains(content(fixture))).toBe(true);
    });

    it('adjoint un badge de verrouillage qui route vers /upgrade', () => {
      const fixture = render();

      expect(badge(fixture)).not.toBeNull();

      const lockedLink = fixture.nativeElement.querySelector(
        'a[href*="upgrade"]',
      ) as HTMLAnchorElement | null;
      expect(lockedLink).not.toBeNull();
      expect(lockedLink?.getAttribute('href')).toContain('/upgrade');
    });
  });

  describe('réactivité', () => {
    it('passe du verrouillé (grisé + badge) au nominal propre quand l’entitlement arrive', async () => {
      granted.set(new Set());
      const fixture = render();
      expect(disabledWrapper(fixture)).not.toBeNull();
      expect(badge(fixture)).not.toBeNull();

      granted.set(new Set<Feature>(['budget.import']));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(content(fixture)).not.toBeNull();
      expect(disabledWrapper(fixture)).toBeNull();
      expect(badge(fixture)).toBeNull();
    });

    it('suit le changement d’input feature', async () => {
      granted.set(new Set<Feature>(['budget.import']));
      const fixture = render();
      expect(badge(fixture)).toBeNull();

      fixture.componentInstance.feature.set('family.sharing');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(badge(fixture)).not.toBeNull();
      expect(disabledWrapper(fixture)).not.toBeNull();
      expect(content(fixture)).not.toBeNull();
    });
  });
});
