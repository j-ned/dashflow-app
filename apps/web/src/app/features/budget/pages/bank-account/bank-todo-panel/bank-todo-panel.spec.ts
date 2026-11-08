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
    <app-bank-todo-panel [count]="count()">
      <p data-testid="projected">contenu</p>
    </app-bank-todo-panel>
  `,
})
class TodoHost {
  readonly count = signal(3);
}

function mount(count: number) {
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
});
