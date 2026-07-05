import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { Envelope } from '../../domain/models/envelope.model';
import { EnvelopeCard } from './envelope-card';

const ENV: Envelope = {
  id: 'e1',
  memberId: null,
  name: 'Vacances',
  type: 'vacances',
  balance: 300,
  target: null,
  color: '#00ff00',
  dueDay: null,
};

function mount(envelope: Envelope = ENV) {
  TestBed.configureTestingModule({
    imports: [
      EnvelopeCard,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(EnvelopeCard);
  fixture.componentRef.setInput('envelope', envelope);
  fixture.componentRef.setInput('entries', []);
  fixture.componentRef.setInput('member', null);
  fixture.detectChanges();
  return fixture;
}

describe('EnvelopeCard', () => {
  it('affiche le nom de l’enveloppe', () => {
    const fixture = mount();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Vacances');
  });

  it('émet credit/edit/remove au clic sur les actions', () => {
    const fixture = mount();
    const el = fixture.nativeElement as HTMLElement;
    const inst = fixture.componentInstance;
    let credited = false;
    let edited = false;
    let removed = false;
    inst.credit.subscribe(() => (credited = true));
    inst.edit.subscribe(() => (edited = true));
    inst.remove.subscribe(() => (removed = true));

    const buttons = el.querySelectorAll<HTMLButtonElement>('div.mt-auto button');
    // ordre dans le footer carte : Créditer, Éditer, Supprimer
    buttons[0].click();
    buttons[1].click();
    buttons[2].click();

    expect(credited).toBe(true);
    expect(edited).toBe(true);
    expect(removed).toBe(true);
  });

  it('affiche le ruban quand le solde atteint l’objectif', () => {
    const fixture = mount({ ...ENV, target: 300, balance: 300 });
    const ribbon = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="achievement-ribbon"]',
    );
    expect(ribbon).not.toBeNull();
  });

  it('pas de ruban si le solde est sous l’objectif', () => {
    const fixture = mount({ ...ENV, target: 500, balance: 300 });
    const ribbon = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="achievement-ribbon"]',
    );
    expect(ribbon).toBeNull();
  });

  it('pas de ruban sans objectif', () => {
    const fixture = mount({ ...ENV, target: null });
    const ribbon = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="achievement-ribbon"]',
    );
    expect(ribbon).toBeNull();
  });
});
