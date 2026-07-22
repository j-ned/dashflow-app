import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SalaryArchive } from '../../domain/models/salary-archive.model';
import { salaryArchiveRemaining } from '../../domain/salary-archive-remaining';
import {
  availableYears as availableYearsOf,
  filterArchivesByYear,
  importedSpendings as importedSpendingsOf,
  previousMonth as previousMonthOf,
} from '../../domain/salary-archive-list';
import { SalaryArchiveGateway } from '../../domain/gateways/salary-archive.gateway';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { openBlobInNewTab } from '@shared/browser/open-blob-in-new-tab';
import { SalaryYearFilter } from './salary-year-filter/salary-year-filter';
import { SalaryArchiveCard } from './salary-archive-card/salary-archive-card';

@Component({
  selector: 'app-salary-archives',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FormsModule,
    ModalDialog,
    Icon,
    TranslocoPipe,
    SalaryYearFilter,
    SalaryArchiveCard,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'budget.salaryArchive.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">
          {{ 'budget.salaryArchive.subtitle' | transloco }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-cyan px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-cyan/90 transition-colors shadow-sm"
        (click)="openCreateModal()"
      >
        <app-icon name="plus" size="14" /> {{ 'budget.salaryArchive.archiveMonth' | transloco }}
      </button>
    </header>

    @if (availableYears().length > 1) {
      <app-salary-year-filter
        [years]="availableYears()"
        [selected]="filterYear()"
        (selectYear)="filterYear.set($event)"
      />
    }

    @if (archives().length > 0) {
      <div class="space-y-4">
        @for (archive of filteredArchives(); track archive.id) {
          <app-salary-archive-card
            [archive]="archive"
            [expanded]="expandedId() === archive.id"
            [remaining]="remainingOf(archive)"
            [monthLabel]="monthLabel(archive.month)"
            [accountName]="accountName(archive.accountId)"
            (toggled)="toggleExpand(archive.id)"
            (openPayslip)="openPayslip(archive.id)"
            (edit)="openEditModal(archive)"
            (delete)="deleteArchive(archive)"
          />
        }
      </div>
    } @else {
      <div class="text-center py-16 rounded-xl border border-dashed border-border bg-surface">
        <app-icon name="folder" size="48" class="text-text-muted/20 mx-auto mb-4" />
        <p class="text-sm text-text-muted">{{ 'budget.salaryArchive.empty' | transloco }}</p>
        <p class="text-xs text-text-muted mt-1 mb-4">
          {{ 'budget.salaryArchive.emptyHint' | transloco }}
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-ib-cyan px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-cyan/90 transition-colors"
          (click)="openCreateModal()"
        >
          <app-icon name="plus" size="14" /> {{ 'budget.salaryArchive.archiveMonth' | transloco }}
        </button>
      </div>
    }

    <app-modal-dialog
      #createModal
      [title]="
        (editingId() ? 'budget.salaryArchive.modal.editTitle' : 'budget.salaryArchive.modal.title')
          | transloco
      "
      (closed)="resetForm()"
    >
      <form (ngSubmit)="saveArchive()" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="arch-month" class="block text-sm font-medium text-text-muted mb-1"
              >{{ 'budget.salaryArchive.modal.month' | transloco }}
              <span aria-hidden="true">*</span></label
            >
            <input
              id="arch-month"
              type="month"
              [ngModel]="formMonth()"
              (ngModelChange)="formMonth.set($event)"
              name="month"
              aria-required="true"
              class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label for="arch-salary" class="block text-sm font-medium text-text-muted mb-1"
              >{{ 'budget.salaryArchive.modal.salary' | transloco }}
              <span aria-hidden="true">*</span></label
            >
            <input
              id="arch-salary"
              type="number"
              step="0.01"
              [ngModel]="formSalary()"
              (ngModelChange)="formSalary.set($event)"
              name="salary"
              aria-required="true"
              class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
              placeholder="0.00"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="arch-expenses" class="block text-sm font-medium text-text-muted mb-1">{{
              'budget.salaryArchive.modal.fixedCharges' | transloco
            }}</label>
            <input
              id="arch-expenses"
              type="number"
              step="0.01"
              [ngModel]="formTotalExpenses()"
              (ngModelChange)="formTotalExpenses.set($event)"
              name="totalExpenses"
              class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
              placeholder="0.00"
            />
          </div>
          <div>
            <label for="arch-account" class="block text-sm font-medium text-text-muted mb-1">{{
              'budget.salaryArchive.modal.account' | transloco
            }}</label>
            <select
              id="arch-account"
              [ngModel]="formAccountId()"
              (ngModelChange)="formAccountId.set($event)"
              name="accountId"
              class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            >
              <option [ngValue]="null">
                {{ 'budget.salaryArchive.modal.accountNone' | transloco }}
              </option>
              @for (acc of accounts(); track acc.id) {
                <option [ngValue]="acc.id">{{ acc.name }}</option>
              }
            </select>
          </div>
        </div>

        @if (!editingId()) {
          <div>
            <label class="flex items-center gap-2 text-sm text-text-muted mb-2">
              <input
                type="checkbox"
                [ngModel]="useCurrentSpendings()"
                (ngModelChange)="useCurrentSpendings.set($event)"
                name="useCurrent"
                class="rounded border-border"
              />
              {{ 'budget.salaryArchive.modal.importSpendings' | transloco }}
            </label>
            @if (useCurrentSpendings() && importedSpendings().length > 0) {
              <div
                class="rounded-xl border border-border/50 bg-canvas overflow-hidden max-h-40 overflow-y-auto"
              >
                <div class="divide-y divide-border/20">
                  @for (s of importedSpendings(); track $index) {
                    <div class="flex justify-between px-3 py-1.5 text-xs">
                      <span class="text-text-primary">{{ s.label }}</span>
                      <span class="font-mono text-ib-yellow"
                        >-{{ s.amount | number: '1.2-2' }}&euro;</span
                      >
                    </div>
                  }
                </div>
                <div
                  class="px-3 py-2 border-t border-border/50 bg-canvas/50 flex justify-between text-xs font-medium"
                >
                  <span class="text-[10px] uppercase tracking-wider text-text-muted">{{
                    'budget.salaryArchive.modal.total' | transloco
                  }}</span>
                  <span class="font-mono font-bold text-ib-yellow"
                    >{{ importedSpendingsTotal() | number: '1.2-2' }}&euro;</span
                  >
                </div>
              </div>
            }
          </div>

          <div>
            <label for="arch-payslip" class="block text-sm font-medium text-text-muted mb-1">{{
              'budget.salaryArchive.modal.payslip' | transloco
            }}</label>
            <input
              id="arch-payslip"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              (change)="onFileSelected($event)"
              class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-ib-cyan/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-ib-cyan"
            />
          </div>
        }

        <footer class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            class="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
            (click)="createModalRef().close()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="submit"
            [disabled]="!formMonth() || !formSalary()"
            class="rounded-lg bg-ib-cyan px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-cyan/90 transition-colors disabled:opacity-50"
          >
            {{
              (editingId()
                ? 'budget.salaryArchive.modal.editSubmit'
                : 'budget.salaryArchive.modal.submit'
              ) | transloco
            }}
          </button>
        </footer>
      </form>
    </app-modal-dialog>
  `,
})
export class SalaryArchives {
  private readonly gateway = inject(SalaryArchiveGateway);
  private readonly recurringEntryGateway = inject(RecurringEntryGateway);
  private readonly bankAccountGateway = inject(BankAccountGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  protected readonly createModalRef = viewChild.required<ModalDialog>('createModal');

  private readonly _refresh = signal(0);

  protected readonly archives = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.gateway.getAll())),
    { initialValue: [] },
  );

  protected readonly accounts = toSignal(this.bankAccountGateway.getAll(), { initialValue: [] });

  private readonly allEntries = toSignal(this.recurringEntryGateway.getAll(), { initialValue: [] });

  protected readonly expandedId = signal<string | null>(null);

  // Year filter. Defaults to "Toutes" (null) so nothing is hidden.
  protected readonly filterYear = signal<string | null>(null);
  protected readonly availableYears = computed(() => availableYearsOf(this.archives()));
  protected readonly filteredArchives = computed(() =>
    filterArchivesByYear(this.archives(), this.filterYear()),
  );

  protected readonly formMonth = signal(this.previousMonth());
  protected readonly formSalary = signal<number | null>(null);
  protected readonly formTotalExpenses = signal<number | null>(null);
  protected readonly formAccountId = signal<string | null>(null);
  protected readonly useCurrentSpendings = signal(true);
  protected readonly editingId = signal<string | null>(null);
  private _editingArchive: SalaryArchive | null = null;
  private _selectedFile: File | null = null;

  protected readonly importedSpendings = computed(() =>
    importedSpendingsOf(this.allEntries(), {
      month: this.formMonth(),
      accountId: this.formAccountId(),
    }),
  );

  protected readonly importedSpendingsTotal = computed(() =>
    this.importedSpendings().reduce((s, e) => s + e.amount, 0),
  );

  private readonly accountMap = computed(() => {
    const map = new Map<string, string>();
    for (const a of this.accounts()) map.set(a.id, a.name);
    return map;
  });

  protected toggleExpand(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  protected readonly remainingOf = salaryArchiveRemaining;

  protected monthLabel(month: string): string {
    const [y, m] = month.split('-');
    const monthName = this._i18n.translate(`budget.salaryArchive.messages.monthFull.${Number(m)}`);
    return `${monthName} ${y}`;
  }

  protected accountName(id: string | null): string | null {
    if (!id) return null;
    return this.accountMap().get(id) ?? null;
  }

  protected async openPayslip(id: string) {
    const blob = await lastValueFrom(this.gateway.downloadPayslip(id));
    openBlobInNewTab(blob);
  }

  protected onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this._selectedFile = input.files?.[0] ?? null;
  }

  protected openCreateModal() {
    this.formMonth.set(this.previousMonth());
    this.createModalRef().open();
  }

  protected openEditModal(archive: SalaryArchive) {
    this.editingId.set(archive.id);
    this._editingArchive = archive;
    this.formMonth.set(archive.month);
    this.formSalary.set(archive.salary);
    this.formTotalExpenses.set(archive.totalExpenses);
    this.formAccountId.set(archive.accountId);
    this.useCurrentSpendings.set(false);
    this.createModalRef().open();
  }

  protected saveArchive() {
    return this.editingId() ? this.updateArchive() : this.createArchive();
  }

  private async updateArchive() {
    const id = this.editingId();
    const original = this._editingArchive;
    const month = this.formMonth();
    const salary = this.formSalary();
    if (!id || !original || !month || !salary) return;

    // Conserve dépenses + fiche de paie, n'édite que mois / salaire / charges / compte.
    const updated: SalaryArchive = {
      ...original,
      month,
      salary,
      totalExpenses: this.formTotalExpenses() ?? 0,
      accountId: this.formAccountId(),
    };
    try {
      await lastValueFrom(this.gateway.update(id, updated));
      this.toaster.success('budget.salaryArchive.messages.updated');
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('budget.salaryArchive.messages.updateError');
    }
  }

  protected async createArchive() {
    const month = this.formMonth();
    const salary = this.formSalary();
    if (!month || !salary) return;

    const spendings = this.useCurrentSpendings() ? this.importedSpendings() : [];
    const totalSpendings = spendings.reduce((s, e) => s + e.amount, 0);

    const fd = new FormData();
    fd.append('month', month);
    fd.append('salary', String(salary));
    fd.append('totalExpenses', String(this.formTotalExpenses() ?? 0));
    fd.append('totalSpendings', String(totalSpendings));
    fd.append('spendings', JSON.stringify(spendings));
    if (this.formAccountId()) fd.append('accountId', this.formAccountId()!);
    if (this._selectedFile) fd.append('payslip', this._selectedFile);

    try {
      await lastValueFrom(this.gateway.create(fd));
      this.toaster.success('budget.salaryArchive.messages.created');
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('budget.salaryArchive.messages.createError');
    }
  }

  protected async deleteArchive(archive: SalaryArchive) {
    if (
      !(await this.confirm.confirm({
        title: this._i18n.translate('budget.salaryArchive.messages.deleteConfirmTitle'),
        message: this._i18n.translate('budget.salaryArchive.messages.deleteConfirmMessage', {
          month: this.monthLabel(archive.month),
        }),
        confirmLabel: this._i18n.translate('budget.actions.delete'),
        variant: 'danger',
      }))
    )
      return;
    try {
      await lastValueFrom(this.gateway.delete(archive.id));
      this.toaster.success('budget.salaryArchive.messages.deleted');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('budget.salaryArchive.messages.deleteError');
    }
  }

  protected resetForm() {
    this.formSalary.set(null);
    this.formTotalExpenses.set(null);
    this.formAccountId.set(null);
    this.useCurrentSpendings.set(true);
    this.editingId.set(null);
    this._editingArchive = null;
    this._selectedFile = null;
  }

  private previousMonth(): string {
    return previousMonthOf(new Date());
  }
}
