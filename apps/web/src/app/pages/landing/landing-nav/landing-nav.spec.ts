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
  return f.nativeElement as HTMLElement;
}
describe('LandingNav', () => {
  it('rend le logo et les liens login/cta', () => {
    const el = mount();
    expect(el.textContent).toContain('dashflow');
    expect(el.textContent).toContain('landing.nav.login');
    expect(el.textContent).toContain('landing.nav.cta');
  });
});
