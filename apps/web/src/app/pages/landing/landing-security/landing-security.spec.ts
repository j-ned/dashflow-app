import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingSecurity } from './landing-security';
function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingSecurity,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const f = TestBed.createComponent(LandingSecurity);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}
describe('LandingSecurity', () => {
  it('rend le titre et les badges crypto', () => {
    const el = mount();
    expect(el.textContent).toContain('landing.how.title');
    expect(el.textContent).toContain('PBKDF2');
    expect(el.textContent).toContain('AES-256-GCM');
  });
});
