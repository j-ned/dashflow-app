import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountTransactionGateway } from '../../../domain/gateways/account-transaction.gateway';
import { parseCsv, mapRows } from '../../../domain/csv-import';
import { CsvMapping } from '../../../domain/models/parsed-transaction.model';
import { markDuplicates, ExistingTx } from '../../../domain/import-dedup';
import { suggestCategory } from '../../../domain/import-categorize';
import { CATEGORY_GROUPS } from '../../../domain/categories';

type ReviewRow = {
  date: string;
  label: string;
  amount: number;
  direction: 'income' | 'expense';
  category: string;
  duplicate: boolean;
  selected: boolean;
};

@Component({
  selector: 'app-csv-import-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    @if (step() === 1) {
      <div class="space-y-4">
        <p class="text-sm text-text-muted">{{ 'budget.transactions.import.step1' | transloco }}</p>
        <div>
          <label for="csv-import-file" class="block text-sm font-medium text-text-primary mb-2">
            {{ 'budget.transactions.import.fileLabel' | transloco }}
          </label>
          <input
            id="csv-import-file"
            type="file"
            accept=".csv"
            class="block w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-raised file:px-4 file:py-2 file:text-sm file:font-medium file:text-text-primary hover:file:bg-hover file:cursor-pointer cursor-pointer"
            (change)="onFile($event)"
          />
          @if (readError()) {
            <p class="mt-2 text-xs text-ib-red" role="alert">
              {{ 'budget.transactions.import.readError' | transloco }}
            </p>
          }
        </div>
      </div>
    }

    @if (step() === 2) {
      <div class="space-y-4">
        <p class="text-sm font-medium text-text-primary">
          {{ 'budget.transactions.import.step2' | transloco }}
        </p>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label for="csv-import-date" class="block text-xs font-medium text-text-muted mb-1">{{
              'budget.transactions.import.date' | transloco
            }}</label>
            <select
              id="csv-import-date"
              class="w-full rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm text-text-primary"
              [ngModel]="mapping().dateCol"
              (ngModelChange)="setMapping({ dateCol: +$event })"
            >
              @for (h of headers(); track i; let i = $index) {
                <option [value]="i">{{ h }}</option>
              }
            </select>
          </div>

          <div>
            <label for="csv-import-label" class="block text-xs font-medium text-text-muted mb-1">{{
              'budget.transactions.import.label' | transloco
            }}</label>
            <select
              id="csv-import-label"
              class="w-full rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm text-text-primary"
              [ngModel]="mapping().labelCol"
              (ngModelChange)="setMapping({ labelCol: +$event })"
            >
              @for (h of headers(); track i; let i = $index) {
                <option [value]="i">{{ h }}</option>
              }
            </select>
          </div>

          <div>
            <label for="csv-import-amount" class="block text-xs font-medium text-text-muted mb-1">{{
              'budget.transactions.import.amount' | transloco
            }}</label>
            <select
              id="csv-import-amount"
              class="w-full rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm text-text-primary"
              [ngModel]="amountSignedCol()"
              (ngModelChange)="setSignedCol(+$event)"
            >
              @for (h of headers(); track i; let i = $index) {
                <option [value]="i">{{ h }}</option>
              }
            </select>
          </div>

          <div>
            <label
              for="csv-import-date-format"
              class="block text-xs font-medium text-text-muted mb-1"
              >{{ 'budget.transactions.import.dateFormat' | transloco }}</label
            >
            <select
              id="csv-import-date-format"
              class="w-full rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm text-text-primary"
              [ngModel]="mapping().dateFormat"
              (ngModelChange)="setMapping({ dateFormat: $event })"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button
            type="button"
            class="rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors"
            (click)="buildReview()"
          >
            {{ 'budget.transactions.import.preview' | transloco }}
          </button>
        </div>
      </div>
    }

    @if (step() === 3) {
      <div class="space-y-4">
        <p class="text-sm font-medium text-text-primary">
          {{ 'budget.transactions.import.step3' | transloco }}
        </p>

        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead class="bg-raised">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-text-muted w-8"></th>
                <th class="px-3 py-2 text-left text-xs font-medium text-text-muted">
                  {{ 'budget.transactions.import.date' | transloco }}
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-text-muted">
                  {{ 'budget.transactions.import.label' | transloco }}
                </th>
                <th class="px-3 py-2 text-right text-xs font-medium text-text-muted">
                  {{ 'budget.transactions.import.amount' | transloco }}
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-text-muted">
                  {{ 'budget.transactions.import.category' | transloco }}
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-text-muted"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40">
              @for (r of reviewRows(); track $index; let i = $index) {
                <tr [class.opacity-50]="!r.selected" class="hover:bg-hover/30 transition-colors">
                  <td class="px-3 py-2">
                    <input
                      type="checkbox"
                      class="rounded border-border"
                      [ngModel]="r.selected"
                      (ngModelChange)="setRow(i, { selected: $event })"
                    />
                  </td>
                  <td class="px-3 py-2 text-text-muted text-xs whitespace-nowrap">{{ r.date }}</td>
                  <td class="px-3 py-2 text-text-primary max-w-40 truncate">{{ r.label }}</td>
                  <td
                    class="px-3 py-2 text-right font-mono text-xs"
                    [class.text-ib-green]="r.direction === 'income'"
                    [class.text-ib-red]="r.direction === 'expense'"
                  >
                    {{ r.direction === 'income' ? '+' : '-' }}{{ r.amount | number: '1.2-2' }}
                  </td>
                  <td class="px-3 py-2">
                    <select
                      class="rounded border border-border/40 bg-canvas px-2 py-1 text-xs text-text-primary"
                      [ngModel]="r.category"
                      (ngModelChange)="setRow(i, { category: $event })"
                    >
                      @for (g of categoryGroups; track g.key) {
                        <optgroup [label]="g.label">
                          @for (cat of g.categories; track cat.key) {
                            <option [value]="cat.key">{{ cat.label }}</option>
                          }
                        </optgroup>
                      }
                    </select>
                  </td>
                  <td class="px-3 py-2">
                    @if (r.duplicate) {
                      <span
                        class="inline-flex items-center rounded-full bg-ib-orange/10 px-2 py-0.5 text-xs font-medium text-ib-orange"
                      >
                        {{ 'budget.transactions.import.duplicate' | transloco }}
                      </span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="flex justify-between items-center pt-2">
          <span class="text-sm text-text-muted"
            >{{ toImport().length }} / {{ reviewRows().length }}
            {{ 'budget.transactions.import.selected' | transloco }}</span
          >
          <button
            type="button"
            class="rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="toImport().length === 0"
            (click)="runImport()"
          >
            {{ 'budget.transactions.import.confirm' | transloco: { count: toImport().length } }}
          </button>
        </div>
      </div>
    }
  `,
})
export class CsvImportWizard {
  private readonly _txGateway = inject(AccountTransactionGateway);
  readonly accountId = input.required<string>();
  readonly existing = input<ExistingTx[]>([]);
  readonly imported = output<number>();

  protected readonly step = signal<1 | 2 | 3>(1);
  protected readonly headers = signal<string[]>([]);
  protected readonly rawRows = signal<string[][]>([]);
  protected readonly mapping = signal<CsvMapping>({
    dateCol: 0,
    labelCol: 1,
    amountMode: { kind: 'signed', col: 2 },
    dateFormat: 'DD/MM/YYYY',
  });
  protected readonly reviewRows = signal<ReviewRow[]>([]);
  protected readonly readError = signal(false);
  protected readonly categoryGroups = CATEGORY_GROUPS;

  protected amountSignedCol(): number {
    const mode = this.mapping().amountMode;
    return mode.kind === 'signed' ? mode.col : 2;
  }

  protected onFile(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.readError.set(false);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result));
      this.headers.set(parsed.headers);
      this.rawRows.set(parsed.rows);
      this.step.set(2);
    };
    reader.onerror = () => this.readError.set(true);
    reader.readAsText(file);
  }

  protected setMapping(patch: Partial<CsvMapping>): void {
    this.mapping.update((m) => ({ ...m, ...patch }));
  }
  protected setSignedCol(col: number): void {
    this.mapping.update((m) => ({ ...m, amountMode: { kind: 'signed', col } }));
  }

  protected buildReview(): void {
    const mapped = mapRows(this.rawRows(), this.mapping());
    const flagged = markDuplicates(mapped, this.existing());
    this.reviewRows.set(
      flagged.map((t) => ({ ...t, category: suggestCategory(t.label), selected: !t.duplicate })),
    );
    this.step.set(3);
  }

  protected toImport(): ReviewRow[] {
    return this.reviewRows().filter((r) => r.selected);
  }
  protected setRow(i: number, patch: Partial<ReviewRow>): void {
    this.reviewRows.update((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  protected runImport(): void {
    const rows = this.toImport();
    if (rows.length === 0) return;
    this._txGateway
      .createBatch(
        this.accountId(),
        rows.map((r) => ({
          amount: r.amount,
          direction: r.direction,
          toAccountId: null,
          date: r.date,
          category: r.category,
          note: null,
          memberId: null,
          recurringEntryId: null,
        })),
      )
      .subscribe(() => this.imported.emit(rows.length));
  }
}
