import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { Upgrade } from './upgrade';

function mount(inputs: { feature?: string; reason?: string; returnUrl?: string } = {}) {
  TestBed.configureTestingModule({
    imports: [
      Upgrade,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const f = TestBed.createComponent(Upgrade);
  if (inputs.feature) f.componentRef.setInput('feature', inputs.feature);
  if (inputs.reason) f.componentRef.setInput('reason', inputs.reason);
  if (inputs.returnUrl) f.componentRef.setInput('returnUrl', inputs.returnUrl);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

const card = (el: HTMLElement, key: string) =>
  el.querySelector<HTMLElement>(`[data-testid="pricing-card-${key}"]`);

describe('Upgrade', () => {
  it('affiche les plans payants (contexte app, Solo masqué)', () => {
    const el = mount();
    expect(card(el, 'solo')).toBeNull();
    expect(card(el, 'family')).not.toBeNull();
    expect(card(el, 'family_health')).not.toBeNull();
  });

  it('met en avant le plan requis par la feature bloquée', () => {
    const el = mount({ feature: 'medical.access' });
    // medical.access → family_health
    expect(card(el, 'family_health')!.className).toContain('border-ib-blue');
    expect(card(el, 'family')!.className).toContain('border-border');
  });

  it('met en avant Famille pour une feature budget', () => {
    const el = mount({ feature: 'budget.import' });
    expect(card(el, 'family')!.className).toContain('border-ib-blue');
  });
});
