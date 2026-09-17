import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AppointmentActions } from './appointment-actions';

function mount(scheduled: boolean) {
  TestBed.configureTestingModule({
    imports: [
      AppointmentActions,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(AppointmentActions);
  fixture.componentRef.setInput('scheduled', scheduled);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = (id: string) => el.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  return { fixture, button };
}

describe('AppointmentActions', () => {
  it('rendez-vous planifié : compléter, annuler, modifier, supprimer', () => {
    const { button } = mount(true);

    expect(button('appointment-complete')).not.toBeNull();
    expect(button('appointment-cancel')).not.toBeNull();
    expect(button('appointment-edit')).not.toBeNull();
    expect(button('appointment-delete')).not.toBeNull();
  });

  it('rendez-vous terminé ou annulé : plus de compléter ni d’annuler', () => {
    const { button } = mount(false);

    expect(button('appointment-complete')).toBeNull();
    expect(button('appointment-cancel')).toBeNull();
    expect(button('appointment-edit')).not.toBeNull();
    expect(button('appointment-delete')).not.toBeNull();
  });

  it('les boutons icône sont nommés pour les lecteurs d’écran', () => {
    const { button } = mount(true);

    for (const id of ['appointment-cancel', 'appointment-edit', 'appointment-delete']) {
      expect(button(id)?.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it.each([
    ['appointment-complete', 'completed'],
    ['appointment-cancel', 'cancelled'],
    ['appointment-edit', 'edited'],
    ['appointment-delete', 'deleted'],
  ] as const)('clic sur %s → émet %s', (id, outputName) => {
    const { fixture, button } = mount(true);
    const spy = vi.fn();
    fixture.componentInstance[outputName].subscribe(spy);

    button(id)?.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
