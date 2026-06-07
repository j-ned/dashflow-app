import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Loan } from '../../domain/models/loan.model';
import { LoanVM } from '../../domain/loan-vm';
import { MemberDisplay } from '../../domain/member-map';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-loan-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, Icon, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <article
      class="group relative overflow-hidden border-b border-r border-border/30 p-5 transition"
      [class]="hoverClass()"
    >
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold shrink-0"
            [class]="badgeClass()"
          >
            {{ vm().pct | number: '1.0-0' }}%
          </div>
          <div>
            <p class="text-sm font-semibold text-text-primary">{{ vm().loan.person }}</p>
            <div class="flex flex-wrap items-center gap-2 mt-0.5">
              @if (member(); as mInfo) {
                <span class="inline-flex items-center gap-1 text-[10px] text-text-muted">
                  <span
                    class="inline-block h-2 w-2 rounded-full"
                    [style.background-color]="mInfo.color"
                  ></span>
                  {{ mInfo.name }}
                </span>
              }
              @if (vm().loan.dueDay) {
                <span
                  class="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-mono text-text-muted"
                >
                  {{ 'budget.loan.dueDayLabel' | transloco: { day: vm().loan.dueDay } }}
                </span>
              }
            </div>
          </div>
        </div>
        <div class="text-right">
          <span class="block text-lg font-mono font-bold" [class]="remainingClass()"
            >{{ vm().loan.remaining | number: '1.2-2'
            }}<span class="text-sm ml-0.5">&euro;</span></span
          >
          <span class="text-[10px] text-text-muted">{{
            'budget.loan.remainingLabel' | transloco
          }}</span>
        </div>
      </div>

      @if (vm().loan.description) {
        <p class="text-[11px] text-text-muted mb-3">{{ vm().loan.description }}</p>
      }

      <!-- Status badge: text + icon, never colour alone -->
      @switch (vm().status) {
        @case ('overdue') {
          <span
            class="mb-3 inline-flex items-center gap-1 rounded-md bg-ib-red/10 px-2 py-0.5 text-[11px] font-semibold text-ib-red"
          >
            <app-icon name="alert-triangle" size="12" />
            {{ 'budget.loan.status.overdue' | transloco }}
          </span>
        }
        @case ('dueSoon') {
          <span
            class="mb-3 inline-flex items-center gap-1 rounded-md bg-ib-yellow/10 px-2 py-0.5 text-[11px] font-semibold text-ib-yellow"
          >
            <app-icon name="clock" size="12" /> {{ 'budget.loan.status.dueSoon' | transloco }}
          </span>
        }
        @case ('settled') {
          <span
            class="mb-3 inline-flex items-center gap-1 rounded-md bg-ib-green/10 px-2 py-0.5 text-[11px] font-semibold text-ib-green"
          >
            <app-icon name="check" size="12" /> {{ 'budget.loan.status.settled' | transloco }}
          </span>
        }
      }

      <div class="grid grid-cols-3 gap-2 text-xs mb-3">
        <div class="rounded-lg bg-canvas p-2 border border-border/30">
          <p class="text-[10px] text-text-muted">{{ 'budget.loan.amount' | transloco }}</p>
          <p class="font-mono font-medium text-text-primary">
            {{ vm().loan.amount | number: '1.2-2' }}&euro;
          </p>
        </div>
        <div class="rounded-lg bg-canvas p-2 border border-border/30">
          <p class="text-[10px] text-text-muted">{{ 'budget.loan.repaid' | transloco }}</p>
          <p class="font-mono font-medium text-ib-green">
            {{ vm().repaid | number: '1.2-2' }}&euro;
          </p>
        </div>
        <div class="rounded-lg bg-canvas p-2 border border-border/30">
          <p class="text-[10px] text-text-muted">{{ 'budget.loan.remaining' | transloco }}</p>
          <p class="font-mono font-medium" [class]="remainingClass()">
            {{ vm().loan.remaining | number: '1.2-2' }}&euro;
          </p>
        </div>
      </div>

      @if (vm().loan.date || vm().loan.dueDate) {
        <div class="grid grid-cols-2 gap-2 text-xs mb-3">
          <div>
            <p class="text-[10px] text-text-muted">{{ dateKey() | transloco }}</p>
            <p class="text-text-primary">{{ vm().loan.date | date: 'dd/MM/yyyy' }}</p>
          </div>
          @if (vm().loan.dueDate) {
            <div>
              <p class="text-[10px] text-text-muted">{{ 'budget.loan.dueDate' | transloco }}</p>
              <p class="text-text-primary">{{ vm().loan.dueDate | date: 'dd/MM/yyyy' }}</p>
            </div>
          }
        </div>
      }

      <div class="flex justify-between text-[10px] text-text-muted mb-1">
        <span>{{ 'budget.loan.repayment' | transloco }}</span>
        <span class="font-mono font-semibold">{{ vm().pct | number: '1.0-0' }}%</span>
      </div>
      <div class="h-2 rounded-full bg-hover overflow-hidden">
        <div
          class="h-full rounded-full transition duration-500 ease-out"
          [class]="barClass()"
          [style.width.%]="clampedPct()"
        ></div>
      </div>

      <div class="mt-3 pt-3 border-t border-border/30">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{{
            'budget.loan.recentActivity' | transloco
          }}</span>
          @if (vm().entries.length > 0) {
            <button
              type="button"
              class="text-[10px] font-medium text-ib-cyan hover:underline"
              (click)="history.emit(vm().loan)"
            >
              {{ 'budget.loan.viewAll' | transloco }}
            </button>
          }
        </div>
        @if (vm().entries.length > 0) {
          <ul class="space-y-1">
            @for (entry of recentEntries(); track entry.tx.id) {
              <li class="flex items-center justify-between gap-2 text-xs">
                <span class="flex min-w-0 items-center gap-1.5 text-text-muted">
                  <app-icon name="banknote" size="12" class="text-ib-green" />
                  {{ entry.tx.date | date: 'dd/MM/yy' }}
                </span>
                <span class="shrink-0 font-mono text-ib-green"
                  >+{{ entry.tx.amount | number: '1.2-2' }}&euro;</span
                >
              </li>
            }
          </ul>
        } @else {
          <p class="text-xs text-text-muted">{{ 'budget.loan.noActivity' | transloco }}</p>
        }
      </div>

      <div
        class="flex flex-wrap items-center justify-end gap-2 mt-3 pt-3 border-t border-border/30"
      >
        @if (vm().status !== 'settled') {
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            [class]="repayClass()"
            [attr.aria-label]="
              'budget.loan.actions.repayAria' | transloco: { person: vm().loan.person }
            "
            (click)="repay.emit(vm().loan)"
          >
            <app-icon name="banknote" size="14" /> {{ 'budget.loan.actions.repay' | transloco }}
          </button>
        }
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-hover hover:text-ib-cyan"
          [attr.aria-label]="
            'budget.loan.actions.historyAria' | transloco: { person: vm().loan.person }
          "
          (click)="history.emit(vm().loan)"
        >
          <app-icon name="clock" size="14" /> {{ 'budget.loan.actions.history' | transloco }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
          [attr.aria-label]="editAriaKey() | transloco: { person: vm().loan.person }"
          (click)="edit.emit(vm().loan)"
        >
          <app-icon name="pencil" size="14" /> {{ 'budget.loan.actions.edit' | transloco }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-ib-red/10 hover:text-ib-red hover:border-ib-red/30"
          [attr.aria-label]="deleteAriaKey() | transloco: { person: vm().loan.person }"
          (click)="remove.emit(vm().loan)"
        >
          <app-icon name="trash" size="14" /> {{ 'budget.loan.actions.delete' | transloco }}
        </button>
      </div>
    </article>
  `,
})
export class LoanCard {
  readonly vm = input.required<LoanVM>();
  readonly member = input<MemberDisplay | null>(null);

  readonly repay = output<Loan>();
  readonly history = output<Loan>();
  readonly edit = output<Loan>();
  readonly remove = output<Loan>();

  private readonly lent = computed(() => this.vm().loan.direction === 'lent');
  protected readonly clampedPct = computed(() => Math.min(100, this.vm().pct));
  protected readonly recentEntries = computed(() => this.vm().entries.slice(0, 3));

  protected readonly hoverClass = computed(() =>
    this.lent() ? 'hover:bg-ib-blue/3' : 'hover:bg-ib-orange/3',
  );
  protected readonly badgeClass = computed(() =>
    this.lent() ? 'bg-ib-blue/10 text-ib-blue' : 'bg-ib-orange/10 text-ib-orange',
  );
  protected readonly remainingClass = computed(() =>
    this.lent() ? 'text-ib-blue' : 'text-ib-red',
  );
  protected readonly barClass = computed(() => (this.lent() ? 'bg-ib-blue' : 'bg-ib-orange'));
  protected readonly repayClass = computed(() =>
    this.lent()
      ? 'bg-ib-blue/10 text-ib-blue hover:bg-ib-blue/20'
      : 'bg-ib-orange/10 text-ib-orange hover:bg-ib-orange/20',
  );
  protected readonly dateKey = computed(() =>
    this.lent() ? 'budget.loan.loanDate' : 'budget.loan.borrowDate',
  );
  protected readonly editAriaKey = computed(() =>
    this.lent() ? 'budget.loan.actions.editLentAria' : 'budget.loan.actions.editBorrowedAria',
  );
  protected readonly deleteAriaKey = computed(() =>
    this.lent() ? 'budget.loan.actions.deleteLentAria' : 'budget.loan.actions.deleteBorrowedAria',
  );
}
