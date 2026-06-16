import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Toaster } from '@shared/components/toast/toast';
import { LandingComponent } from './landing';

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

function make(opts: { demoLogin?: ReturnType<typeof vi.fn> } = {}) {
  const demoLogin = opts.demoLogin ?? vi.fn(() => Promise.resolve());
  const error = vi.fn();
  TestBed.configureTestingModule({
    imports: [
      LandingComponent,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { demoLogin } },
      { provide: Toaster, useValue: { error, success: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(LandingComponent);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as { startDemo: () => Promise<void> },
    demoLogin,
    error,
    navigate,
  };
}

describe('LandingComponent', () => {
  it('startDemo succès → demoLogin puis navigate /budget (replaceUrl)', async () => {
    const { cmp, demoLogin, navigate } = make();
    await cmp.startDemo();
    expect(demoLogin).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/budget'], { replaceUrl: true });
  });

  it('startDemo échec → toast error, pas de navigate', async () => {
    const { cmp, error, navigate } = make({
      demoLogin: vi.fn(() => Promise.reject(new Error('boom'))),
    });
    await cmp.startDemo();
    expect(error).toHaveBeenCalledWith('landing.hero.demoError');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('monte les 9 sections', () => {
    const el = make().fixture.nativeElement as HTMLElement;
    for (const sel of [
      'app-landing-nav',
      'app-landing-hero',
      'app-landing-problem',
      'app-landing-security',
      'app-landing-budget-pillar',
      'app-landing-medical-pillar',
      'app-landing-faq',
      'app-landing-final-cta',
      'app-landing-footer',
    ]) {
      expect(el.querySelector(sel)).not.toBeNull();
    }
  });
});
