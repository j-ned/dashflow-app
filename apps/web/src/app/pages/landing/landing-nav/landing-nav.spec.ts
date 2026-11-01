import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingNav } from './landing-nav';

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingNav,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const f = TestBed.createComponent(LandingNav);
  f.detectChanges();
  return f;
}

function toggleBtn(el: HTMLElement) {
  return el.querySelector<HTMLButtonElement>('button[aria-controls="landing-mobile-menu"]')!;
}

describe('LandingNav', () => {
  it('rend le logo et les liens login/cta', () => {
    const el = mount().nativeElement as HTMLElement;
    expect(el.textContent).toContain('dashflow');
    expect(el.textContent).toContain('landing.nav.login');
    expect(el.textContent).toContain('landing.nav.cta');
  });

  it('menu mobile fermé par défaut (aria-expanded=false, pas de panneau)', () => {
    const el = mount().nativeElement as HTMLElement;
    expect(toggleBtn(el).getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#landing-mobile-menu')).toBeNull();
  });

  it('le bouton hamburger ouvre puis ferme le panneau', () => {
    const f = mount();
    const el = f.nativeElement as HTMLElement;

    toggleBtn(el).click();
    f.detectChanges();
    expect(toggleBtn(el).getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#landing-mobile-menu')).not.toBeNull();

    toggleBtn(el).click();
    f.detectChanges();
    expect(toggleBtn(el).getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#landing-mobile-menu')).toBeNull();
  });

  it('la touche Échap ferme le panneau ouvert', () => {
    const f = mount();
    const el = f.nativeElement as HTMLElement;

    toggleBtn(el).click();
    f.detectChanges();
    expect(el.querySelector('#landing-mobile-menu')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(el.querySelector('#landing-mobile-menu')).toBeNull();
  });
});
