import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { EnvelopeTransaction } from '../../domain/models/envelope-transaction.model';
import { HistoryEntry } from '../../domain/envelope-history';
import { EnvelopeHistoryList } from './envelope-history-list';

function tx(over: Partial<EnvelopeTransaction> = {}): EnvelopeTransaction {
  return { id: 't1', envelopeId: 'e1', amount: 50, date: '2026-06-01', note: null, ...over };
}

function mount(history: HistoryEntry[]) {
  TestBed.configureTestingModule({
    imports: [
      EnvelopeHistoryList,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(EnvelopeHistoryList);
  fixture.componentRef.setInput('history', history);
  fixture.detectChanges();
  return fixture;
}

describe('EnvelopeHistoryList', () => {
  it('rend une ligne par entrée quand l’historique est non vide', () => {
    const fixture = mount([
      { tx: tx({ id: 'a' }), balanceAfter: 300 },
      { tx: tx({ id: 'b', date: '2026-05-01' }), balanceAfter: 250 },
    ]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('li').length).toBe(2);
  });

  it('rend l’état vide quand l’historique est vide', () => {
    const fixture = mount([]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('li').length).toBe(0);
    expect(el.textContent).toContain('budget.envelope.modal.noTransactions');
  });
});
