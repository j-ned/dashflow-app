import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SalaryArchive } from '../../domain/models/salary-archive.model';
import { salaryArchiveRemaining } from '../../domain/salary-archive-remaining';
import { SalaryArchiveGateway } from '../../domain/gateways/salary-archive.gateway';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-salary-archives',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, FormsModule, ModalDialog, Icon, TranslocoPipe],
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
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium text-text-muted">{{
          'budget.salaryArchive.filterYear' | transloco
        }}</span>
        <button
          type="button"
          class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          [class.border-ib-cyan]="filterYear() === null"
          [class.bg-ib-cyan]="filterYear() === null"
          [class.text-canvas]="filterYear() === null"
          [class.border-border]="filterYear() !== null"
          [class.text-text-muted]="filterYear() !== null"
          (click)="filterYear.set(null)"
        >
          {{ 'budget.salaryArchive.allYears' | transloco }}
        </button>
        @for (year of availableYears(); track year) {
          <button
            type="button"
            class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            [class.border-ib-cyan]="filterYear() === year"
            [class.bg-ib-cyan]="filterYear() === year"
            [class.text-canvas]="filterYear() === year"
            [class.border-border]="filterYear() !== year"
            [class.text-text-muted]="filterYear() !== year"
            (click)="filterYear.set(year)"
          >
            {{ year }}
          </button>
        }
      </div>
    }

    @if (archives().length > 0) {
      <div class="space-y-4">
        @for (archive of filteredArchives(); track archive.id) {
          @let r = remainingOf(archive);
          <article
            class="group rounded-xl border border-border bg-surface overflow-hidden transition hover:shadow-lg hover:shadow-ib-cyan/5"
          >
            <button
              type="button"
              class="w-full flex items-center justify-between px-5 py-4 hover:bg-hover/30 transition-colors"
              (click)="toggleExpand(archive.id)"
            >
              <div class="flex items-center gap-4">
                <div
                  class="flex h-11 w-11 items-center justify-center rounded-xl bg-ib-cyan/10 text-ib-cyan"
                >
                  <app-icon name="folder" size="20" />
                </div>
                <div class="text-left">
                  <p class="text-base font-semibold text-text-primary">
                    {{ monthLabel(archive.month) }}
                  </p>
                  @if (accountName(archive.accountId); as aName) {
                    <span class="text-[11px] text-ib-cyan/60">{{ aName }}</span>
                  }
                </div>
              </div>
              <div class="flex items-center gap-6">
                <div class="text-right">
                  <p class="text-lg font-mono font-bold text-ib-green">
                    {{ archive.salary | number: '1.2-2' }}<span class="text-sm ml-0.5">&euro;</span>
                  </p>
                  <p class="text-[11px] text-text-muted">
                    {{
                      'budget.salaryArchive.expensesLabel'
                        | transloco
                          : {
                              value:
                                (+archive.totalExpenses + +archive.totalSpendings
                                | number: '1.2-2'),
                            }
                    }}
                  </p>
                </div>
                <div
                  class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                  [class.bg-ib-cyan-10]="expandedId() === archive.id"
                  [class.text-ib-cyan]="expandedId() === archive.id"
                  [class.text-text-muted]="expandedId() !== archive.id"
                >
                  <app-icon
                    [name]="expandedId() === archive.id ? 'chevron-up' : 'chevron-down'"
                    size="16"
                  />
                </div>
              </div>
            </button>

            @if (expandedId() === archive.id) {
              <div class="border-t border-border px-5 py-5 space-y-4">
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div
                    class="relative overflow-hidden rounded-xl border border-border bg-canvas p-4"
                  >
                    <div class="flex items-center gap-1.5 mb-2">
                      <div
                        class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-green/10"
                      >
                        <app-icon name="trending-up" size="12" class="text-ib-green" />
                      </div>
                      <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {{ 'budget.salaryArchive.kpi.salary' | transloco }}
                      </p>
                    </div>
                    <p class="text-lg font-mono font-bold text-ib-green tracking-tight">
                      {{ archive.salary | number: '1.2-2'
                      }}<span class="text-xs ml-0.5">&euro;</span>
                    </p>
                  </div>
                  <div
                    class="relative overflow-hidden rounded-xl border border-border bg-canvas p-4"
                  >
                    <div class="flex items-center gap-1.5 mb-2">
                      <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red/10">
                        <app-icon name="receipt" size="12" class="text-ib-red" />
                      </div>
                      <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {{ 'budget.salaryArchive.kpi.fixedCharges' | transloco }}
                      </p>
                    </div>
                    <p class="text-lg font-mono font-bold text-ib-red tracking-tight">
                      {{ archive.totalExpenses | number: '1.2-2'
                      }}<span class="text-xs ml-0.5">&euro;</span>
                    </p>
                  </div>
                  <div
                    class="relative overflow-hidden rounded-xl border border-border bg-canvas p-4"
                  >
                    <div class="flex items-center gap-1.5 mb-2">
                      <div
                        class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-yellow/10"
                      >
                        <app-icon name="banknote" size="12" class="text-ib-yellow" />
                      </div>
                      <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {{ 'budget.salaryArchive.kpi.spendings' | transloco }}
                      </p>
                    </div>
                    <p class="text-lg font-mono font-bold text-ib-yellow tracking-tight">
                      {{ archive.totalSpendings | number: '1.2-2'
                      }}<span class="text-xs ml-0.5">&euro;</span>
                    </p>
                  </div>
                  <div
                    class="relative overflow-hidden rounded-xl border bg-canvas p-4"
                    [class.border-ib-green-30]="r >= 0"
                    [class.border-ib-red-30]="r < 0"
                  >
                    <div class="flex items-center gap-1.5 mb-2">
                      <div
                        class="flex h-6 w-6 items-center justify-center rounded-lg"
                        [class.bg-ib-green-10]="r >= 0"
                        [class.bg-ib-red-10]="r < 0"
                      >
                        <app-icon
                          name="wallet"
                          size="12"
                          [class.text-ib-green]="r >= 0"
                          [class.text-ib-red]="r < 0"
                        />
                      </div>
                      <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {{ 'budget.salaryArchive.kpi.remaining' | transloco }}
                      </p>
                    </div>
                    <p
                      class="text-lg font-mono font-bold tracking-tight"
                      [class.text-ib-green]="r >= 0"
                      [class.text-ib-red]="r < 0"
                    >
                      {{ r >= 0 ? '+' : '' }}{{ r | number: '1.2-2'
                      }}<span class="text-xs ml-0.5">&euro;</span>
                    </p>
                  </div>
                </div>

                @if (archive.spendings.length > 0) {
                  <div class="rounded-xl border border-border overflow-hidden">
                    <div
                      class="flex items-center gap-2 px-4 py-2.5 bg-ib-yellow/5 border-b border-border/50"
                    >
                      <app-icon name="banknote" size="13" class="text-ib-yellow" />
                      <span
                        class="text-[11px] font-semibold uppercase tracking-wider text-ib-yellow"
                        >{{ 'budget.salaryArchive.spendingsDetail' | transloco }}</span
                      >
                    </div>
                    <div class="divide-y divide-border/20">
                      @for (s of archive.spendings; track $index) {
                        <div class="flex items-center justify-between px-4 py-2.5">
                          <div class="flex items-center gap-2 min-w-0">
                            @if (s.date) {
                              <span class="text-[10px] font-mono text-text-muted">{{
                                s.date | date: 'dd/MM'
                              }}</span>
                            }
                            <span class="text-sm text-text-primary truncate">{{ s.label }}</span>
                            @if (s.category) {
                              <span
                                class="inline-flex items-center rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
                                >{{ s.category }}</span
                              >
                            }
                          </div>
                          <span class="text-sm font-mono font-bold text-ib-yellow shrink-0"
                            >-{{ s.amount | number: '1.2-2' }}&euro;</span
                          >
                        </div>
                      }
                    </div>
                  </div>
                }

                <div class="flex items-center justify-between pt-2">
                  @if (archive.payslipKey) {
                    <button
                      type="button"
                      (click)="openPayslip(archive.id)"
                      class="inline-flex items-center gap-1.5 rounded-lg bg-ib-cyan/10 min-h-8 px-3 py-1.5 text-xs font-medium text-ib-cyan hover:bg-ib-cyan/20 transition-colors"
                    >
                      <app-icon name="file-text" size="14" />
                      {{ 'budget.salaryArchive.viewPayslip' | transloco }}
                    </button>
                  } @else {
                    <span class="text-[11px] text-text-muted">{{
                      'budget.salaryArchive.noPayslip' | transloco
                    }}</span>
                  }
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-border min-h-8 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:border-ib-cyan/30 transition-colors"
                    [attr.aria-label]="
                      'budget.salaryArchive.editAria'
                        | transloco: { month: monthLabel(archive.month) }
                    "
                    (click)="openEditModal(archive)"
                  >
                    <app-icon name="pencil" size="14" /> {{ 'budget.actions.edit' | transloco }}
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-border min-h-8 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                    [attr.aria-label]="
                      'budget.salaryArchive.deleteAria'
                        | transloco: { month: monthLabel(archive.month) }
                    "
                    (click)="deleteArchive(archive)"
                  >
                    <app-icon name="trash" size="14" /> {{ 'budget.actions.delete' | transloco }}
                  </button>
                </div>
              </div>
            }
          </article>
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
  protected readonly availableYears = computed(() => {
    const years = new Set(this.archives().map((a) => a.month.slice(0, 4)));
    return [...years].sort((a, b) => b.localeCompare(a));
  });
  protected readonly filteredArchives = computed(() => {
    const y = this.filterYear();
    const all = this.archives();
    return y ? all.filter((a) => a.month.startsWith(y)) : all;
  });

  protected readonly formMonth = signal(this.previousMonth());
  protected readonly formSalary = signal<number | null>(null);
  protected readonly formTotalExpenses = signal<number | null>(null);
  protected readonly formAccountId = signal<string | null>(null);
  protected readonly useCurrentSpendings = signal(true);
  protected readonly editingId = signal<string | null>(null);
  private _editingArchive: SalaryArchive | null = null;
  private _selectedFile: File | null = null;

  protected readonly importedSpendings = computed(() => {
    if (!this.useCurrentSpendings()) return [];
    const month = this.formMonth();
    if (!month) return [];
    const accountId = this.formAccountId();
    return this.allEntries()
      .filter((e) => {
        if (e.type !== 'spending') return false;
        if (accountId && e.accountId !== accountId) return false;
        if (!e.date) return false;
        return e.date.startsWith(month);
      })
      .map((e) => ({
        label: e.label,
        amount: Number(e.amount),
        date: e.date,
        category: e.category,
      }));
  });

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
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.toISOString().slice(0, 7);
  }
}
