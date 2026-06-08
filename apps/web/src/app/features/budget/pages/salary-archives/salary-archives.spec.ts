import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { SalaryArchiveGateway } from '../../domain/gateways/salary-archive.gateway';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { SalaryArchive } from '../../domain/models/salary-archive.model';
import { RecurringEntry } from '../../domain/models/recurring-entry.model';
import { SalaryArchives } from './salary-archives';

const arch = (p: Partial<SalaryArchive>): SalaryArchive => ({
  id: 'a',
  accountId: null,
  month: '2026-01',
  salary: 2000,
  totalExpenses: 800,
  totalSpendings: 150,
  spendings: [],
  payslipKey: null,
  ...p,
});
const entry = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'x',
  memberId: null,
  accountId: null,
  toAccountId: null,
  label: '',
  amount: 0,
  type: 'spending',
  dayOfMonth: null,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
  ...p,
});

type Cmp = {
  availableYears: () => string[];
  filteredArchives: () => SalaryArchive[];
  importedSpendings: () => { label: string; amount: number }[];
  filterYear: { set: (v: string | null) => void };
  formMonth: { set: (v: string) => void };
  formSalary: { set: (v: number | null) => void };
  formTotalExpenses: { set: (v: number | null) => void };
  formAccountId: { set: (v: string | null) => void };
  useCurrentSpendings: { set: (v: boolean) => void };
  createArchive: () => Promise<void>;
  deleteArchive: (a: SalaryArchive) => Promise<void>;
};

function make(
  opts: {
    archives?: SalaryArchive[];
    entries?: RecurringEntry[];
    create?: ReturnType<typeof vi.fn>;
    confirm?: boolean;
  } = {},
) {
  const getAll = vi.fn(() =>
    of(opts.archives ?? [arch({ id: 'a', month: '2026-01' }), arch({ id: 'b', month: '2025-06' })]),
  );
  const create = opts.create ?? vi.fn(() => of(arch({})));
  const update = vi.fn(() => of(arch({})));
  const del = vi.fn(() => of(undefined));
  const success = vi.fn();
  const error = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SalaryArchiveGateway,
        useValue: { getAll, create, update, delete: del, downloadPayslip: () => of(new Blob()) },
      },
      { provide: RecurringEntryGateway, useValue: { getAll: () => of(opts.entries ?? []) } },
      { provide: BankAccountGateway, useValue: { getAll: () => of([]) } },
      { provide: Toaster, useValue: { success, error } },
      {
        provide: ConfirmService,
        useValue: { confirm: () => Promise.resolve(opts.confirm ?? true) },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(SalaryArchives, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(SalaryArchives);
  const refs = fixture.componentInstance as unknown as {
    createModalRef: () => { open: () => void; close: () => void };
  };
  const close = vi.fn();
  refs.createModalRef = () => ({ open: vi.fn(), close });
  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    create,
    update,
    del,
    success,
    error,
    close,
  };
}

describe('SalaryArchives — caractérisation', () => {
  it('availableYears triées desc, filteredArchives par année', () => {
    const { cmp } = make();
    expect(cmp.availableYears()).toEqual(['2026', '2025']);
    cmp.filterYear.set('2025');
    expect(cmp.filteredArchives().map((a) => a.id)).toEqual(['b']);
  });

  it('importedSpendings filtre les dépenses du mois du formulaire', () => {
    const { cmp } = make({
      entries: [
        entry({ id: 'e1', type: 'spending', date: '2026-01-05', label: 'Courses', amount: 30 }),
        entry({ id: 'e2', type: 'spending', date: '2026-02-05', label: 'Autre', amount: 99 }),
      ],
    });
    cmp.useCurrentSpendings.set(true);
    cmp.formMonth.set('2026-01');
    cmp.formAccountId.set(null);
    expect(cmp.importedSpendings().map((s) => s.label)).toEqual(['Courses']);
  });

  it('createArchive envoie un FormData et notifie le succès', async () => {
    let captured: FormData | null = null;
    const create = vi.fn((fd: FormData) => {
      captured = fd;
      return of(arch({}));
    });
    const { cmp, success, close } = make({ create });
    cmp.formMonth.set('2026-03');
    cmp.formSalary.set(2500);
    cmp.formTotalExpenses.set(700);
    cmp.useCurrentSpendings.set(false);
    await cmp.createArchive();
    expect(create).toHaveBeenCalledTimes(1);
    expect(captured!.get('month')).toBe('2026-03');
    expect(captured!.get('salary')).toBe('2500');
    expect(captured!.get('totalExpenses')).toBe('700');
    expect(success).toHaveBeenCalledWith('budget.salaryArchive.messages.created');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('createArchive en erreur → toast error', async () => {
    const { cmp, error } = make({ create: vi.fn(() => throwError(() => new Error('boom'))) });
    cmp.formMonth.set('2026-03');
    cmp.formSalary.set(2500);
    cmp.useCurrentSpendings.set(false);
    await cmp.createArchive();
    expect(error).toHaveBeenCalledWith('budget.salaryArchive.messages.createError');
  });

  it('deleteArchive confirmé → gateway.delete + toast', async () => {
    const { cmp, del, success } = make({ confirm: true });
    await cmp.deleteArchive(arch({ id: 'a' }));
    expect(del).toHaveBeenCalledWith('a');
    expect(success).toHaveBeenCalledWith('budget.salaryArchive.messages.deleted');
  });
});
