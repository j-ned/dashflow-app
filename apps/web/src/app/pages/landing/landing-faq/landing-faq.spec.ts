import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingFaq } from './landing-faq';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingFaq,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const f = TestBed.createComponent(LandingFaq);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('LandingFaq', () => {
  it('rend 3 questions/réponses dans des <details>', () => {
    const el = mount();
    expect(el.querySelectorAll('details').length).toBe(3);
    for (const n of [1, 2, 3]) {
      expect(el.textContent).toContain(`landing.faq.q${n}.question`);
      expect(el.textContent).toContain(`landing.faq.q${n}.answer`);
    }
    expect(el.textContent).toContain('landing.faq.title');
  });
});
