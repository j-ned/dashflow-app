import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { LandingMedicalPillar } from './landing-medical-pillar';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      LandingMedicalPillar,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const f = TestBed.createComponent(LandingMedicalPillar);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('LandingMedicalPillar', () => {
  it('rend le titre medical', () => {
    expect(mount().textContent).toContain('landing.medical.title');
  });
});
