import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingHero } from './landing-hero';

function mount(demoLoading: boolean) {
  TestBed.configureTestingModule({
    imports: [
      LandingHero,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const f = TestBed.createComponent(LandingHero);
  f.componentRef.setInput('demoLoading', demoLoading);
  f.detectChanges();
  return f;
}

describe('LandingHero', () => {
  it('rend le titre et le CTA principal', () => {
    const el = mount(false).nativeElement as HTMLElement;
    expect(el.textContent).toContain('landing.hero.titleLine1');
    expect(el.textContent).toContain('landing.hero.primaryCta');
  });

  it('bouton démo désactivé quand demoLoading', () => {
    const el = mount(true).nativeElement as HTMLElement;
    const demoBtn = el.querySelector('button[type="button"]') as HTMLButtonElement;
    expect(demoBtn.disabled).toBe(true);
  });

  it('émet startDemo au clic', () => {
    const f = mount(false);
    let fired = false;
    f.componentInstance.startDemo.subscribe(() => (fired = true));
    (f.nativeElement as HTMLElement)
      .querySelector('button[type="button"]')!
      .dispatchEvent(new Event('click'));
    expect(fired).toBe(true);
  });
});
