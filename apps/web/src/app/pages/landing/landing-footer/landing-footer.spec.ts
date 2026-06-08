import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingFooter } from './landing-footer';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingFooter,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const f = TestBed.createComponent(LandingFooter);
  f.componentRef.setInput('contactEmail', 'contact@nedellec-julien.fr');
  f.componentRef.setInput('currentYear', 2026);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('LandingFooter', () => {
  it("rend l'email (mailto) et l'année", () => {
    const el = mount();
    expect(el.textContent).toContain('contact@nedellec-julien.fr');
    expect(el.textContent).toContain('2026');
    expect(el.querySelector('a[href="mailto:contact@nedellec-julien.fr"]')).not.toBeNull();
  });
});
