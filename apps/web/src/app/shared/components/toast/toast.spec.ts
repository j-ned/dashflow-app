import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { ToastContainer, Toaster } from './toast';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      ToastContainer,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(ToastContainer);
  const toaster = TestBed.inject(Toaster);
  const actionButton = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="toast-action"]',
    );
  return { fixture, toaster, actionButton };
}

describe('Toaster : action', () => {
  it('sans action : aucun bouton d’action', () => {
    const { fixture, toaster, actionButton } = mount();

    toaster.success('k', undefined, { duration: 0 });
    fixture.detectChanges();

    expect(actionButton()).toBeNull();
  });

  it('avec action : le clic l’exécute une seule fois et ferme le toast', () => {
    const { fixture, toaster, actionButton } = mount();
    const run = vi.fn();
    toaster.success('k', undefined, { duration: 0, action: { labelKey: 'undo', run } });
    fixture.detectChanges();

    actionButton()?.click();
    actionButton()?.click();

    expect(run).toHaveBeenCalledTimes(1);
    expect(toaster.toasts()[0].leaving).toBe(true);
  });
});
