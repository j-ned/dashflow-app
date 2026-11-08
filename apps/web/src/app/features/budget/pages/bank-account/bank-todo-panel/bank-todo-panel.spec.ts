import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { BankTodoPanel } from './bank-todo-panel';

@Component({
  selector: 'app-todo-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BankTodoPanel],
  template: `
    <app-bank-todo-panel [count]="count()" [(open)]="open">
      <p data-testid="projected">contenu</p>
    </app-bank-todo-panel>
  `,
})
class TodoHost {
  readonly count = signal(3);
  readonly open = signal(false);
}

function mount(count: number, open = false) {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { fr: {} },
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(TodoHost);
  fixture.componentInstance.count.set(count);
  fixture.componentInstance.open.set(open);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  return { fixture, host, details: () => host.querySelector('details') };
}

describe('BankTodoPanel', () => {
  it('rien à traiter : le bloc disparaît', () => {
    const { details } = mount(0);

    expect(details()).toBeNull();
  });

  it('replié par défaut, le résumé annonce le nombre de choses à traiter', () => {
    const { details } = mount(3);

    expect(details()?.open).toBe(false);
    expect(details()?.querySelector('summary')?.textContent).toContain('3');
  });

  it('le parent peut le déplier (ex. « Saisir le revenu reçu » depuis le solde)', () => {
    const { details } = mount(2, true);

    expect(details()?.open).toBe(true);
    expect(details()?.querySelector('[data-testid="projected"]')).not.toBeNull();
  });

  it('déplier à la main remonte l’état au parent', () => {
    const { fixture, details } = mount(2);

    details()!.open = true;
    details()!.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();

    expect(fixture.componentInstance.open()).toBe(true);
  });
});
