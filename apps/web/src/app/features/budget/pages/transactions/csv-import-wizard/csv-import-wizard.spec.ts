import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { CsvImportWizard } from './csv-import-wizard';
import { AccountTransactionGateway } from '../../../domain/gateways/account-transaction.gateway';

describe('CsvImportWizard', () => {
  function make() {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        provideHttpClient(),
        { provide: AccountTransactionGateway, useValue: { createBatch: () => of([{}, {}]) } },
      ],
    });
    const fixture = TestBed.createComponent(CsvImportWizard);
    fixture.componentRef.setInput('accountId', 'a');
    fixture.componentRef.setInput('existing', []);
    return fixture;
  }

  it('toImport ne garde que les lignes cochées', () => {
    const fixture = make();
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      reviewRows: { set: (r: unknown[]) => void };
      toImport: () => unknown[];
    };
    cmp.reviewRows.set([
      {
        date: '2026-06-01',
        label: 'Courses',
        amount: 42.5,
        direction: 'expense',
        category: 'food',
        duplicate: false,
        selected: true,
      },
      {
        date: '2026-06-02',
        label: 'Dup',
        amount: 10,
        direction: 'expense',
        category: 'other',
        duplicate: true,
        selected: false,
      },
    ]);
    expect(cmp.toImport().length).toBe(1);
  });
});
