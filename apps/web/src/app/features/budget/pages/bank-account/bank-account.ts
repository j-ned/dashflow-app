import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { RecurringEntry, RecurringEntryType } from '../../domain/models/recurring-entry.model';
import { BankAccount as BankAccountModel } from '../../domain/models/bank-account.model';
import { GetRecurringEntriesUseCase } from '../../domain/use-cases/get-recurring-entries.use-case';
import { CreateRecurringEntryUseCase } from '../../domain/use-cases/create-recurring-entry.use-case';
import { UpdateRecurringEntryUseCase } from '../../domain/use-cases/update-recurring-entry.use-case';
import { DeleteRecurringEntryUseCase } from '../../domain/use-cases/delete-recurring-entry.use-case';
import { GetBankAccountsUseCase } from '../../domain/use-cases/get-bank-accounts.use-case';
import { CreateBankAccountUseCase } from '../../domain/use-cases/create-bank-account.use-case';
import { DeleteBankAccountUseCase } from '../../domain/use-cases/delete-bank-account.use-case';
import { UpdateBankAccountUseCase } from '../../domain/use-cases/update-bank-account.use-case';
import { GetMembersUseCase } from '../../domain/use-cases/get-members.use-case';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { RecurringEntryForm } from '../../components/recurring-entry-form/recurring-entry-form';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { CreateSalaryArchiveUseCase } from '../../domain/use-cases/create-salary-archive.use-case';

const PALETTE = [
  'var(--color-ib-blue)',
  'var(--color-ib-cyan)',
  'var(--color-ib-green)',
  'var(--color-ib-purple)',
  'var(--color-ib-orange)',
  'var(--color-ib-pink)',
  'var(--color-ib-yellow)',
  'var(--color-ib-red)',
] as const;

@Component({
  selector: 'app-bank-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, FormsModule, ModalDialog, RecurringEntryForm, Icon],
  host: { class: 'block space-y-6' },
  template: `
    <!-- Header + compte selector -->
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Compte bancaire</h2>
        <p class="mt-1 text-sm text-text-muted">Suivi progressif de votre solde</p>
      </div>
      <nav class="flex items-center gap-2 flex-wrap">
        @for (account of accounts(); track account.id; let i = $index) {
          <button type="button"
                  class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all"
                  [style.border-color]="selectedAccountId() === account.id ? accountColor(i) : 'var(--border)'"
                  [style.background-color]="selectedAccountId() === account.id ? accountColor(i) : 'transparent'"
                  [class.text-white]="selectedAccountId() === account.id"
                  [class.text-text-muted]="selectedAccountId() !== account.id"
                  (click)="selectAccount(account.id)">
            <span class="inline-block h-2.5 w-2.5 rounded-full"
                  [style.background-color]="accountDotColor(i)"></span>
            {{ account.name }}
          </button>
        }
        <button type="button"
                class="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-text-muted hover:border-ib-cyan/50 hover:text-ib-cyan transition-colors"
                (click)="accountModalRef().open()">
          <app-icon name="settings" size="12" class="inline -mt-0.5" /> Gérer
        </button>
      </nav>
    </header>

    <!-- ═══ KPI Cards ═══ -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <!-- Solde actuel -->
      <div class="group relative overflow-hidden rounded-xl border bg-surface p-5 transition-all"
           [class.border-ib-cyan-40]="currentBalance() >= 0"
           [class.border-ib-red-40]="currentBalance() < 0"
           [class.hover:shadow-lg]="true"
           [class.hover:shadow-ib-cyan-5]="currentBalance() >= 0"
           [class.hover:shadow-ib-red-5]="currentBalance() < 0">
        <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl"
             [class.bg-ib-cyan]="currentBalance() >= 0"
             [class.bg-ib-red]="currentBalance() < 0"></div>
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg"
               [class.bg-ib-cyan-10]="currentBalance() >= 0"
               [class.bg-ib-red-10]="currentBalance() < 0">
            <app-icon name="wallet" size="14"
                      [class.text-ib-cyan]="currentBalance() >= 0"
                      [class.text-ib-red]="currentBalance() < 0" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Solde actuel</p>
        </div>
        <p class="text-2xl font-mono font-bold tracking-tight"
           [class.text-ib-cyan]="currentBalance() >= 0"
           [class.text-ib-red]="currentBalance() < 0">
          {{ currentBalance() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span>
        </p>
        <p class="mt-1.5 text-[11px] text-text-muted">au {{ today }}</p>
      </div>

      <!-- Revenus -->
      <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all hover:border-ib-green/30 hover:shadow-lg hover:shadow-ib-green/5">
        <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-green"></div>
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-green/10">
            <app-icon name="trending-up" size="14" class="text-ib-green" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Revenus</p>
        </div>
        <p class="text-2xl font-mono font-bold text-ib-green tracking-tight">{{ totalIncome() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span></p>
        <p class="mt-1.5 text-[11px] text-text-muted truncate">
          @if (incomes().length === 1) { {{ incomes()[0].label }} } @else { {{ incomes().length }} sources }
        </p>
      </div>

      <!-- Prélèvements mensuels -->
      <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all hover:border-ib-red/30 hover:shadow-lg hover:shadow-ib-red/5">
        <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-red"></div>
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-red/10">
            <app-icon name="receipt" size="14" class="text-ib-red" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Prélèvements</p>
        </div>
        <p class="text-2xl font-mono font-bold text-ib-red tracking-tight">{{ totalMonthlyExpenses() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span></p>
        <p class="mt-1.5 text-[11px] text-text-muted">{{ passedExpenses().length }}/{{ monthlyExpenses().length }} passés</p>
      </div>

      <!-- Prélèvements annuels -->
      <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all hover:border-ib-orange/30 hover:shadow-lg hover:shadow-ib-orange/5">
        <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-orange"></div>
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-orange/10">
            <app-icon name="calendar" size="14" class="text-ib-orange" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Annuels</p>
        </div>
        <p class="text-2xl font-mono font-bold text-ib-orange tracking-tight">{{ totalAnnualExpenses() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;/an</span></p>
        <p class="mt-1.5 text-[11px] text-text-muted">soit ~{{ monthlyAnnualExpenses() | number:'1.2-2' }}&euro;/mois</p>
      </div>

      <!-- Dépenses du mois -->
      <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all hover:border-ib-yellow/30 hover:shadow-lg hover:shadow-ib-yellow/5">
        <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-yellow"></div>
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-yellow/10">
            <app-icon name="banknote" size="14" class="text-ib-yellow" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Dépenses</p>
        </div>
        <p class="text-2xl font-mono font-bold text-ib-yellow tracking-tight">{{ totalMonthSpendings() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span></p>
        <p class="mt-1.5 text-[11px] text-text-muted">{{ monthSpendings().length }} dépense{{ monthSpendings().length > 1 ? 's' : '' }} en {{ spendingMonthLabel() }}</p>
      </div>

      <!-- Solde fin de mois -->
      <div class="group relative overflow-hidden rounded-xl border bg-surface p-5 transition-all"
           [class.border-ib-green-40]="endOfMonthBalance() >= 0"
           [class.border-ib-red-40]="endOfMonthBalance() < 0"
           [class.hover:shadow-lg]="true"
           [class.hover:shadow-ib-green-5]="endOfMonthBalance() >= 0"
           [class.hover:shadow-ib-red-5]="endOfMonthBalance() < 0">
        <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl"
             [class.bg-ib-green]="endOfMonthBalance() >= 0"
             [class.bg-ib-red]="endOfMonthBalance() < 0"></div>
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg"
               [class.bg-ib-green-10]="endOfMonthBalance() >= 0"
               [class.bg-ib-red-10]="endOfMonthBalance() < 0">
            <app-icon name="calendar" size="14"
                      [class.text-ib-green]="endOfMonthBalance() >= 0"
                      [class.text-ib-red]="endOfMonthBalance() < 0" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Solde fin de cycle</p>
        </div>
        <p class="text-2xl font-mono font-bold tracking-tight"
           [class.text-ib-green]="endOfMonthBalance() >= 0"
           [class.text-ib-red]="endOfMonthBalance() < 0">
          {{ endOfMonthBalance() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span>
        </p>
        <p class="mt-1.5 text-[11px] text-text-muted">après toutes charges du cycle</p>
      </div>
    </section>

    <!-- ═══ Barre de progression ═══ -->
    @if (totalIncome() > 0 && totalAllExpenses() > 0) {
      <section class="rounded-xl border border-border bg-surface p-4">
        <div class="flex items-center justify-between mb-2.5">
          <span class="text-xs font-medium text-text-muted">Budget utilisé</span>
          <span class="text-sm font-mono font-bold"
                [class.text-ib-green]="usagePercent() <= 80"
                [class.text-ib-orange]="usagePercent() > 80 && usagePercent() <= 100"
                [class.text-ib-red]="usagePercent() > 100">
            {{ usagePercent() | number:'1.0-0' }}%
          </span>
        </div>
        <div class="h-2.5 rounded-full bg-hover overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500 ease-out"
               [style.width.%]="usagePercent() > 100 ? 100 : usagePercent()"
               [class.bg-gradient-to-r]="true"
               [class.from-ib-green]="usagePercent() <= 80"
               [class.to-ib-green-70]="usagePercent() <= 80"
               [class.from-ib-orange]="usagePercent() > 80 && usagePercent() <= 100"
               [class.to-ib-orange-70]="usagePercent() > 80 && usagePercent() <= 100"
               [class.from-ib-red]="usagePercent() > 100"
               [class.to-ib-red-70]="usagePercent() > 100">
          </div>
        </div>
        <!-- Légende segmentée -->
        <div class="flex items-center gap-4 mt-2.5 text-[10px] text-text-muted">
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-red"></span> Passés {{ totalPassedExpenses() | number:'1.0-0' }}&euro;</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-red/40"></span> A venir {{ totalUpcomingExpenses() | number:'1.0-0' }}&euro;</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-orange"></span> Annuels ~{{ monthlyAnnualExpenses() | number:'1.0-0' }}&euro;/m</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-yellow"></span> Dépenses {{ totalMonthSpendings() | number:'1.0-0' }}&euro;</span>
        </div>
      </section>
    }

    <!-- ═══ Revenus ═══ -->
    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 bg-ib-green/5 border-b border-border/50">
        <div class="flex items-center gap-2">
          <app-icon name="trending-up" size="16" class="text-ib-green" />
          <h3 class="text-xs font-semibold uppercase tracking-wider text-ib-green">Revenus</h3>
        </div>
        <button type="button"
                class="inline-flex items-center gap-1 rounded-lg bg-ib-green px-3 py-1.5 text-xs font-medium text-white hover:bg-ib-green/90 transition-colors shadow-sm"
                (click)="openCreateModal('income')">
          <app-icon name="plus" size="12" /> Revenu
        </button>
      </div>
      @if (incomes().length > 0) {
        <div class="divide-y divide-border/30">
          @for (entry of incomes(); track entry.id) {
            <div class="group flex items-center justify-between px-5 py-3.5 hover:bg-ib-green/3 transition-colors">
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-ib-green/10 text-ib-green text-xs font-bold shrink-0">
                  @if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                </div>
                <div>
                  <p class="text-sm font-semibold text-text-primary">{{ entry.label }}</p>
                  <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                    @if (entry.category) {
                      <span class="inline-flex items-center rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-medium text-text-muted">{{ entry.category }}</span>
                    }
                    @if (entry.date) {
                      <span class="text-[11px] text-text-muted">{{ entry.date | date:'dd/MM/yyyy' }}</span>
                    }
                    @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                      <span class="inline-flex items-center gap-1 text-[11px] text-text-muted">
                        @if (memberMap().get(entry.memberId ?? '')?.color; as mc) {
                          <span class="inline-block h-2 w-2 rounded-full shrink-0" [style.background-color]="mc"></span>
                        }
                        {{ mName }}
                      </span>
                    }
                    @if (entry.payslipKey) {
                      <button type="button"
                              class="inline-flex items-center gap-0.5 rounded-md bg-ib-green/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-green hover:bg-ib-green/20 transition-colors cursor-pointer"
                              (click)="openPayslipById(entry.id); $event.stopPropagation()">
                        <app-icon name="file-text" size="10" /> Fiche de paie
                      </button>
                    }
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-lg font-mono font-bold text-ib-green">+{{ entry.amount | number:'1.2-2' }}<span class="text-sm">&euro;</span></span>
                <div class="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button type="button"
                          class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors"
                          [title]="'Modifier — ' + entry.label"
                          [attr.aria-label]="'Modifier ' + entry.label"
                          (click)="openEditModal(entry)">
                    <app-icon name="pencil" size="13" />
                  </button>
                  <button type="button"
                          class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                          [title]="'Supprimer — ' + entry.label"
                          [attr.aria-label]="'Supprimer ' + entry.label"
                          (click)="deleteEntry(entry.id)">
                    <app-icon name="trash" size="13" />
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="px-5 py-8 text-center">
          <app-icon name="trending-up" size="32" class="text-text-muted/20 mx-auto mb-2" />
          <p class="text-sm text-text-muted">Ajoutez votre salaire ou autres revenus mensuels</p>
        </div>
      }
    </section>

    <!-- ═══ 3 colonnes : Prélèvements / Annuels / Dépenses ═══ -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start" #accountGrid>

      <!-- Prélèvements mensuels -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden" #refCard>
        <div class="flex items-center justify-between px-4 py-3 bg-ib-red/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="receipt" size="14" class="text-ib-red" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-red">Mensuels</h3>
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red text-white hover:bg-ib-red/80 transition-colors shadow-sm"
                  (click)="openCreateModal('expense')">
            <app-icon name="plus" size="12" />
          </button>
        </div>
        @if (sortedMonthlyExpenses().length > 0) {
          <div class="divide-y divide-border/20 px-3 py-1.5">
            @for (entry of sortedMonthlyExpenses(); track entry.id) {
              @let passed = isExpensePassed(entry);
              <div class="group flex items-center justify-between py-2 hover:bg-ib-red/3 rounded-lg px-1.5 -mx-1.5 transition-colors"
                   [class.opacity-50]="passed">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold shrink-0"
                       [class.bg-ib-red-10]="!passed" [class.text-ib-red]="!passed"
                       [class.bg-ib-green-10]="passed" [class.text-ib-green]="passed">
                    @if (passed) { <app-icon name="check" size="14" /> } @else if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-text-primary truncate" [class.line-through]="passed">{{ entry.label }}</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                      @if (passed) {
                        <span class="text-[10px] text-ib-green font-medium">Prélevé</span>
                      } @else if (entry.dayOfMonth) {
                        <span class="text-[10px] text-text-muted">le {{ entry.dayOfMonth }}</span>
                      }
                      @if (entry.endDate) {
                        <span class="inline-flex items-center gap-0.5 rounded-md bg-ib-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-orange">
                          <app-icon name="calendar" size="9" /> Jusqu'au {{ entry.endDate | date:'MM/yyyy' }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold" [class.text-ib-red]="!passed" [class.text-text-muted]="passed">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <div class="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors"
                            [title]="'Modifier — ' + entry.label" [attr.aria-label]="'Modifier ' + entry.label"
                            (click)="openEditModal(entry)">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors"
                            [title]="'Supprimer — ' + entry.label" [attr.aria-label]="'Supprimer ' + entry.label"
                            (click)="deleteEntry(entry.id)">
                      <app-icon name="trash" size="11" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">Total</span>
            <span class="text-sm font-mono font-bold text-ib-red">{{ totalMonthlyExpenses() | number:'1.2-2' }} &euro;</span>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">Loyer, abonnements, assurances...</p>
          </div>
        }
      </section>

      <!-- Prélèvements annuels -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden flex flex-col" [style.max-height.px]="refCardHeight()">
        <div class="flex items-center justify-between px-4 py-3 bg-ib-orange/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="calendar" size="14" class="text-ib-orange" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">Annuels</h3>
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-orange text-white hover:bg-ib-orange/80 transition-colors shadow-sm"
                  (click)="openCreateModal('annual_expense')">
            <app-icon name="plus" size="12" />
          </button>
        </div>
        @if (annualExpenses().length > 0) {
          <div class="divide-y divide-border/20 px-3 py-1.5 overflow-y-auto flex-1">
            @for (entry of annualExpenses(); track entry.id) {
              <div class="group flex items-center justify-between py-2 hover:bg-ib-orange/3 rounded-lg px-1.5 -mx-1.5 transition-colors">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-orange/10 text-ib-orange text-[10px] font-bold shrink-0">
                    @if (entry.date) { {{ entry.date | date:'MMM' }} } @else { AN }
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-text-primary truncate">{{ entry.label }}</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-[10px] text-text-muted">~{{ entry.amount / 12 | number:'1.2-2' }}&euro;/mois</span>
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                      @if (entry.endDate) {
                        <span class="inline-flex items-center gap-0.5 rounded-md bg-ib-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-orange">
                          <app-icon name="calendar" size="9" /> Jusqu'au {{ entry.endDate | date:'MM/yyyy' }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold text-ib-orange">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <div class="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors"
                            [title]="'Modifier — ' + entry.label" [attr.aria-label]="'Modifier ' + entry.label"
                            (click)="openEditModal(entry)">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors"
                            [title]="'Supprimer — ' + entry.label" [attr.aria-label]="'Supprimer ' + entry.label"
                            (click)="deleteEntry(entry.id)">
                      <app-icon name="trash" size="11" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">Total</span>
            <div class="text-right">
              <span class="text-sm font-mono font-bold text-ib-orange">{{ totalAnnualExpenses() | number:'1.2-2' }} &euro;/an</span>
              <span class="text-[10px] text-text-muted ml-1">(~{{ monthlyAnnualExpenses() | number:'1.2-2' }}&euro;/m)</span>
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">Assurance auto, impôts fonciers...</p>
          </div>
        }
      </section>

      <!-- Dépenses -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden flex flex-col" [style.max-height.px]="refCardHeight()">
        <div class="flex items-center justify-between px-4 py-3 bg-ib-yellow/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="banknote" size="14" class="text-ib-yellow" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-yellow">Dépenses</h3>
            <div class="flex items-center gap-0.5 ml-1">
              <button type="button"
                      class="rounded p-0.5 text-text-muted hover:text-ib-yellow hover:bg-ib-yellow/10 transition-colors"
                      (click)="prevMonth()">
                <app-icon name="chevron-right" size="12" class="rotate-180" />
              </button>
              <span class="text-[11px] font-medium text-text-primary min-w-20 text-center">{{ spendingMonthLabel() }}</span>
              <button type="button"
                      class="rounded p-0.5 text-text-muted hover:text-ib-yellow hover:bg-ib-yellow/10 transition-colors"
                      (click)="nextMonth()">
                <app-icon name="chevron-right" size="12" />
              </button>
            </div>
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-yellow text-white hover:bg-ib-yellow/80 transition-colors shadow-sm"
                  (click)="openCreateModal('spending')">
            <app-icon name="plus" size="12" />
          </button>
        </div>
        @if (monthSpendings().length > 0) {
          <div class="divide-y divide-border/20 px-3 py-1.5 overflow-y-auto flex-1">
            @for (entry of monthSpendings(); track entry.id) {
              <div class="group flex items-center justify-between py-2 hover:bg-ib-yellow/3 rounded-lg px-1.5 -mx-1.5 transition-colors">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-yellow/10 text-ib-yellow text-[10px] font-bold shrink-0">
                    @if (entry.date) { {{ entry.date | date:'dd' }} } @else if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-text-primary truncate">{{ entry.label }}</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (entry.date) {
                        <span class="text-[10px] text-text-muted">{{ entry.date | date:'dd/MM' }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold text-ib-yellow">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <div class="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors"
                            [title]="'Modifier — ' + entry.label" [attr.aria-label]="'Modifier ' + entry.label"
                            (click)="openEditModal(entry)">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors"
                            [title]="'Supprimer — ' + entry.label" [attr.aria-label]="'Supprimer ' + entry.label"
                            (click)="deleteEntry(entry.id)">
                      <app-icon name="trash" size="11" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">Total</span>
            <span class="text-sm font-mono font-bold text-ib-yellow">{{ totalMonthSpendings() | number:'1.2-2' }} &euro;</span>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">Aucune dépense en {{ spendingMonthLabel() }}</p>
          </div>
        }
      </section>
    </div>

    <!-- ═══ Virements automatiques ═══ -->
    @if (transfers().length > 0 || accounts().length > 1) {
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 bg-ib-purple/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="credit-card" size="16" class="text-ib-purple" />
            <h3 class="text-xs font-semibold uppercase tracking-wider text-ib-purple">Virements automatiques</h3>
          </div>
          <button type="button"
                  class="inline-flex items-center gap-1 rounded-lg bg-ib-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-ib-purple/90 transition-colors shadow-sm"
                  (click)="openCreateModal('transfer', 'recurring')">
            <app-icon name="plus" size="12" /> Virement récurrent
          </button>
        </div>
        @if (recurringTransfers().length > 0) {
          <div class="divide-y divide-border/30">
            @for (entry of recurringTransfers(); track entry.id) {
              @let passed = isExpensePassed(entry);
              <div class="group flex items-center justify-between px-5 py-3.5 hover:bg-ib-purple/3 transition-colors"
                   [class.opacity-50]="passed">
                <div class="flex items-center gap-3">
                  <div class="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold shrink-0"
                       [class.bg-ib-green-10]="passed" [class.text-ib-green]="passed"
                       [class.bg-ib-purple-10]="!passed" [class.text-ib-purple]="!passed">
                    @if (passed) { <app-icon name="check" size="14" /> } @else if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-text-primary" [class.line-through]="passed">{{ entry.label }}</p>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                      @if (accountNameById(entry.accountId); as fromName) {
                        <span class="text-[11px] text-text-muted">{{ fromName }}</span>
                      }
                      <app-icon name="arrow-right" size="10" class="text-text-muted" />
                      @if (accountNameById(entry.toAccountId); as toName) {
                        <span class="text-[11px] text-ib-purple font-medium">{{ toName }}</span>
                      }
                      @if (entry.endDate) {
                        <span class="inline-flex items-center gap-0.5 rounded-md bg-ib-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-orange">
                          <app-icon name="calendar" size="9" /> Jusqu'au {{ entry.endDate | date:'MM/yyyy' }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-lg font-mono font-bold text-ib-purple">{{ entry.amount | number:'1.2-2' }}<span class="text-sm">&euro;</span></span>
                  <div class="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button"
                            class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors"
                            [title]="'Modifier — ' + entry.label" [attr.aria-label]="'Modifier ' + entry.label"
                            (click)="openEditModal(entry)">
                      <app-icon name="pencil" size="13" />
                    </button>
                    <button type="button"
                            class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                            [title]="'Supprimer — ' + entry.label" [attr.aria-label]="'Supprimer ' + entry.label"
                            (click)="deleteEntry(entry.id)">
                      <app-icon name="trash" size="13" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="px-5 py-8 text-center">
            <app-icon name="credit-card" size="32" class="text-text-muted/20 mx-auto mb-2" />
            <p class="text-sm text-text-muted">Programmez des virements automatiques entre vos comptes</p>
          </div>
        }
      </section>

      <!-- ═══ Virements ponctuels ═══ -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 bg-ib-cyan/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="arrow-left-right" size="16" class="text-ib-cyan" />
            <h3 class="text-xs font-semibold uppercase tracking-wider text-ib-cyan">Virements ponctuels</h3>
            <div class="flex items-center gap-0.5 ml-1">
              <button type="button"
                      class="rounded p-0.5 text-text-muted hover:text-ib-cyan hover:bg-ib-cyan/10 transition-colors"
                      aria-label="Mois précédent"
                      (click)="prevMonth()">
                <app-icon name="chevron-right" size="12" class="rotate-180" />
              </button>
              <span class="text-[11px] font-medium text-text-primary min-w-20 text-center">{{ spendingMonthLabel() }}</span>
              <button type="button"
                      class="rounded p-0.5 text-text-muted hover:text-ib-cyan hover:bg-ib-cyan/10 transition-colors"
                      aria-label="Mois suivant"
                      (click)="nextMonth()">
                <app-icon name="chevron-right" size="12" />
              </button>
            </div>
          </div>
          <button type="button"
                  class="inline-flex items-center gap-1 rounded-lg bg-ib-cyan px-3 py-1.5 text-xs font-medium text-white hover:bg-ib-cyan/90 transition-colors shadow-sm"
                  (click)="openCreateModal('transfer', 'one_time')">
            <app-icon name="plus" size="12" /> Virement ponctuel
          </button>
        </div>
        @if (monthOneTimeTransfers().length > 0) {
          <div class="divide-y divide-border/30">
            @for (entry of monthOneTimeTransfers(); track entry.id) {
              @let isOutgoing = entry.accountId === selectedAccountId();
              <div class="group flex items-center justify-between px-5 py-3.5 hover:bg-ib-cyan/3 transition-colors">
                <div class="flex items-center gap-3">
                  <div class="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold shrink-0 bg-ib-cyan/10 text-ib-cyan">
                    @if (entry.date) { {{ entry.date | date:'dd' }} } @else { — }
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-text-primary">{{ entry.label }}</p>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                      @if (accountNameById(entry.accountId); as fromName) {
                        <span class="text-[11px] text-text-muted">{{ fromName }}</span>
                      }
                      <app-icon name="arrow-right" size="10" class="text-text-muted" />
                      @if (accountNameById(entry.toAccountId); as toName) {
                        <span class="text-[11px] text-ib-cyan font-medium">{{ toName }}</span>
                      }
                      @if (entry.date) {
                        <span class="text-[10px] text-text-muted">{{ entry.date | date:'dd/MM' }}</span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-lg font-mono font-bold"
                        [class.text-ib-red]="isOutgoing"
                        [class.text-ib-green]="!isOutgoing">
                    {{ isOutgoing ? '-' : '+' }}{{ entry.amount | number:'1.2-2' }}<span class="text-sm">&euro;</span>
                  </span>
                  <div class="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button"
                            class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors"
                            [title]="'Modifier — ' + entry.label" [attr.aria-label]="'Modifier ' + entry.label"
                            (click)="openEditModal(entry)">
                      <app-icon name="pencil" size="13" />
                    </button>
                    <button type="button"
                            class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                            [title]="'Supprimer — ' + entry.label" [attr.aria-label]="'Supprimer ' + entry.label"
                            (click)="deleteEntry(entry.id)">
                      <app-icon name="trash" size="13" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="px-5 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">Total du mois</span>
            <div class="flex items-center gap-3 text-[11px] font-mono">
              @if (totalOneTimeOutgoing() > 0) {
                <span class="text-ib-red">-{{ totalOneTimeOutgoing() | number:'1.2-2' }}&euro;</span>
              }
              @if (totalOneTimeIncoming() > 0) {
                <span class="text-ib-green">+{{ totalOneTimeIncoming() | number:'1.2-2' }}&euro;</span>
              }
            </div>
          </div>
        } @else {
          <div class="px-5 py-8 text-center">
            <app-icon name="arrow-left-right" size="32" class="text-text-muted/20 mx-auto mb-2" />
            <p class="text-sm text-text-muted">Aucun virement ponctuel en {{ spendingMonthLabel() }}</p>
          </div>
        }
      </section>
    }

    <!-- ═══ Timeline du mois ═══ -->
    @if (timelineEvents().length > 0) {
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-blue/5 border-b border-border/50">
          <app-icon name="calendar" size="16" class="text-ib-blue" />
          <h3 class="text-xs font-semibold uppercase tracking-wider text-ib-blue">Timeline du mois</h3>
        </div>
        <div class="px-5 py-4">
          <div class="relative">
            <!-- Ligne verticale -->
            <div class="absolute left-3.5 top-0 bottom-0 w-px bg-border"></div>
            <div class="space-y-0.5">
              @for (event of timelineEvents(); track event.id) {
                <div class="relative flex items-center gap-3 py-1.5 pl-9">
                  <!-- Point sur la ligne -->
                  <div class="absolute left-2 h-3 w-3 rounded-full border-2 border-surface"
                       [class.bg-ib-green]="event.type === 'income'"
                       [class.bg-ib-red]="event.type === 'expense'"
                       [class.bg-ib-orange]="event.type === 'annual_expense'"
                       [class.bg-ib-purple]="event.type === 'transfer'"
                       [class.bg-ib-yellow]="event.type === 'spending'"
                       [class.ring-2]="event.day === currentDay"
                       [class.ring-ib-cyan]="event.day === currentDay"></div>
                  <!-- Jour -->
                  <span class="text-[11px] font-mono font-bold w-5 shrink-0"
                        [class.text-ib-cyan]="event.day === currentDay"
                        [class.text-text-muted]="event.day !== currentDay">
                    {{ event.day }}
                  </span>
                  <!-- Label -->
                  <span class="text-[13px] truncate flex-1"
                        [class.text-text-muted]="event.passed"
                        [class.line-through]="event.passed"
                        [class.text-text-primary]="!event.passed">
                    {{ event.label }}
                  </span>
                  <!-- Montant -->
                  <span class="text-[13px] font-mono font-bold shrink-0"
                        [class.text-ib-green]="event.type === 'income'"
                        [class.text-ib-red]="event.type === 'expense'"
                        [class.text-ib-orange]="event.type === 'annual_expense'"
                        [class.text-ib-purple]="event.type === 'transfer'"
                        [class.text-ib-yellow]="event.type === 'spending'"
                        [class.opacity-50]="event.passed">
                    {{ event.sign }}{{ event.amount | number:'1.2-2' }}&euro;
                  </span>
                </div>
              }
            </div>
            <!-- Marqueur "Aujourd'hui" -->
            <div class="relative flex items-center gap-3 py-1.5 pl-9 mt-1">
              <div class="absolute left-1.5 h-4 w-4 rounded-full bg-ib-cyan/20 border-2 border-ib-cyan"></div>
              <span class="text-[11px] font-mono font-bold w-5 text-ib-cyan shrink-0">{{ currentDay }}</span>
              <span class="text-[11px] font-semibold text-ib-cyan uppercase tracking-wider">Aujourd'hui</span>
              <span class="text-[13px] font-mono font-bold text-ib-cyan shrink-0">{{ currentBalance() | number:'1.2-2' }}&euro;</span>
            </div>
          </div>
        </div>
      </section>
    }

    <!-- ═══ Modals ═══ -->
    <app-modal-dialog #accountModal title="Gestion des comptes" (closed)="resetAccountForm()">
      @if (accountModal.isOpen()) {
        <div class="space-y-6">
          <!-- Liste des comptes existants -->
          @if (accounts().length > 0) {
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Comptes existants</p>
              <div class="rounded-xl border border-border overflow-hidden divide-y divide-border/30">
                @for (account of accounts(); track account.id; let i = $index) {
                  <div class="px-4 py-3 hover:bg-hover/30 transition-colors space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="inline-flex items-center gap-2">
                          <span class="inline-block h-3 w-3 rounded-full" [style.background-color]="accountDotColor(i)"></span>
                          <span class="inline-block h-4 w-4 rounded-md" [style.background-color]="accountColor(i)"></span>
                        </span>
                        <span class="text-sm font-medium text-text-primary">{{ account.name }}</span>
                      </div>
                      <button type="button"
                              class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                              [title]="'Supprimer — ' + account.name"
                              [attr.aria-label]="'Supprimer le compte ' + account.name"
                              (click)="deleteAccount(account)">
                        <app-icon name="trash" size="14" />
                      </button>
                    </div>
                    <div class="flex items-center gap-2 pl-10">
                      <label class="text-[11px] text-text-muted whitespace-nowrap">Solde initial</label>
                      <input type="number" step="0.01"
                             class="w-32 rounded-lg border border-border bg-raised px-2 py-1 text-xs font-mono text-text-primary text-right"
                             [value]="account.initialBalance"
                             (change)="updateAccountBalance(account.id, $event)" />
                      <span class="text-[11px] text-text-muted">&euro;</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Ajouter un nouveau compte -->
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Ajouter un compte</p>
            <form (ngSubmit)="createAccount()" class="space-y-3">
              <div>
                <label for="acc-name" class="block text-sm font-medium text-text-muted mb-1">Nom <span aria-hidden="true">*</span></label>
                <input id="acc-name" type="text" [ngModel]="newAccountName()" (ngModelChange)="newAccountName.set($event)" name="name"
                       class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                       placeholder="Ex: Compte courant, Compte joint..." />
              </div>
              <div>
                <label for="acc-balance" class="block text-sm font-medium text-text-muted mb-1">Solde de départ</label>
                <div class="relative">
                  <input id="acc-balance" type="number" step="0.01" [ngModel]="newAccountBalance()" (ngModelChange)="newAccountBalance.set($event)" name="balance"
                         class="w-full rounded-lg border border-border bg-raised px-3 py-2 pr-8 text-sm font-mono text-text-primary"
                         placeholder="0.00" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">&euro;</span>
                </div>
                <p class="mt-1 text-xs text-text-muted">Solde actuel de votre compte en banque</p>
              </div>
              <p class="text-xs text-text-muted">Les couleurs sont attribuées automatiquement.</p>
              <footer class="flex justify-end gap-3 pt-2">
                <button type="button"
                        class="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
                        (click)="accountModalRef().close()">
                  Fermer
                </button>
                <button type="submit" [disabled]="!newAccountName().trim()"
                        class="rounded-lg bg-ib-cyan px-4 py-2 text-sm font-medium text-white hover:bg-ib-cyan/90 transition-colors disabled:opacity-50">
                  Ajouter
                </button>
              </footer>
            </form>
          </div>
        </div>
      }
    </app-modal-dialog>

    <app-modal-dialog #createModal [title]="createModalTitle()" (closed)="onModalClosed()">
      @if (createModal.isOpen()) {
        <app-recurring-entry-form [forcedType]="createType()" [forcedAccountId]="selectedAccountId()" [initialTransferMode]="createTransferMode()" [accounts]="accounts()" [members]="members()" (submitted)="createEntry($event)" (cancelled)="createModal.close()" />
      }
    </app-modal-dialog>

    <app-modal-dialog #editModal [title]="editModalTitle()" (closed)="onModalClosed()">
      @if (editModal.isOpen()) {
        <app-recurring-entry-form [initial]="selectedEntry()" [accounts]="accounts()" [members]="members()"
          (submitted)="updateEntry($event)"
          (fileAttached)="uploadPayslip($event)"
          (viewPayslip)="openPayslip()"
          (removePayslip)="deletePayslip()"
          (cancelled)="editModal.close()" />
      }
    </app-modal-dialog>
  `,
})
export class BankAccount {
  private readonly getEntries = inject(GetRecurringEntriesUseCase);
  private readonly createEntryUC = inject(CreateRecurringEntryUseCase);
  private readonly updateEntryUC = inject(UpdateRecurringEntryUseCase);
  private readonly deleteEntryUC = inject(DeleteRecurringEntryUseCase);
  private readonly getMembersUC = inject(GetMembersUseCase);
  private readonly getAccountsUC = inject(GetBankAccountsUseCase);
  private readonly createAccountUC = inject(CreateBankAccountUseCase);
  private readonly updateAccountUC = inject(UpdateBankAccountUseCase);
  private readonly deleteAccountUC = inject(DeleteBankAccountUseCase);
  private readonly entryGateway = inject(RecurringEntryGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly createArchiveUC = inject(CreateSalaryArchiveUseCase);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  protected readonly accountModalRef = viewChild.required<ModalDialog>('accountModal');
  private readonly _refCard = viewChild<ElementRef<HTMLElement>>('refCard');

  protected readonly refCardHeight = signal<number | null>(null);

  private readonly _refresh = signal(0);
  private readonly _refreshAccounts = signal(0);

  private readonly allEntries = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getEntries.execute())),
    { initialValue: [] },
  );

  protected readonly accounts = toSignal(
    toObservable(this._refreshAccounts).pipe(switchMap(() => this.getAccountsUC.execute())),
    { initialValue: [] },
  );

  protected readonly members = toSignal(this.getMembersUC.execute(), { initialValue: [] });

  protected readonly selectedAccountId = linkedSignal<string | null>(() => {
    const accs = this.accounts();
    return accs.length > 0 ? accs[0].id : null;
  });

  constructor() {
    afterNextRender(() => {
      const el = this._refCard()?.nativeElement;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => this.refCardHeight.set(entry.borderBoxSize[0].blockSize));
      ro.observe(el);
    });
  }

  protected readonly filteredEntries = computed(() => {
    const accountId = this.selectedAccountId();
    const all = this.allEntries();
    if (accountId === null) return all;
    return all.filter(e => e.accountId === accountId);
  });

  private readonly currentMonth = new Date().toISOString().slice(0, 7);

  private isActive(entry: RecurringEntry): boolean {
    if (!entry.endDate) return true;
    return entry.endDate.slice(0, 7) >= this.currentMonth;
  }

  protected readonly incomes = computed(() => this.filteredEntries().filter(e => e.type === 'income' && this.isActive(e)));
  protected readonly monthlyExpenses = computed(() => this.filteredEntries().filter(e => e.type === 'expense' && this.isActive(e)));
  protected readonly annualExpenses = computed(() => this.filteredEntries().filter(e => e.type === 'annual_expense' && this.isActive(e)));
  protected readonly allSpendings = computed(() => this.filteredEntries().filter(e => e.type === 'spending'));

  // Virements : ceux du compte sélectionné (source) + ceux qui arrivent sur ce compte (cible)
  protected readonly transfers = computed(() => {
    const accountId = this.selectedAccountId();
    const all = this.allEntries().filter(e => e.type === 'transfer' && this.isActive(e));
    if (accountId === null) return all;
    return all.filter(e => e.accountId === accountId || e.toAccountId === accountId);
  });

  // Virements récurrents (avec dayOfMonth)
  protected readonly recurringTransfers = computed(() =>
    this.transfers().filter(e => e.dayOfMonth != null)
  );

  // Virements ponctuels (avec date, sans dayOfMonth)
  protected readonly oneTimeTransfers = computed(() =>
    this.transfers().filter(e => !e.dayOfMonth && !!e.date)
  );

  // Virements ponctuels du mois sélectionné
  protected readonly monthOneTimeTransfers = computed(() => {
    const ym = this.spendingMonth();
    return this.oneTimeTransfers()
      .filter(e => e.date!.startsWith(ym))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  });

  // Virements sortants du compte sélectionné (débit) — récurrents uniquement
  private readonly outgoingTransfers = computed(() => {
    const accountId = this.selectedAccountId();
    return this.recurringTransfers().filter(e => e.accountId === accountId);
  });

  // Virements entrants sur le compte sélectionné (crédit) — récurrents uniquement
  private readonly incomingTransfers = computed(() => {
    const accountId = this.selectedAccountId();
    return this.recurringTransfers().filter(e => e.toAccountId === accountId);
  });

  protected readonly spendingMonth = signal(new Date().toISOString().slice(0, 7));

  protected readonly spendingMonthLabel = computed(() => {
    const [y, m] = this.spendingMonth().split('-');
    const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return `${MONTHS[Number(m) - 1]} ${y}`;
  });

  protected readonly monthSpendings = computed(() => {
    const ym = this.spendingMonth();
    return this.allSpendings()
      .filter(e => {
        if (!e.date) return true;
        return e.date.startsWith(ym);
      })
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  });

  protected readonly sortedMonthlyExpenses = computed(() =>
    [...this.monthlyExpenses()].sort((a, b) => (a.dayOfMonth ?? 32) - (b.dayOfMonth ?? 32))
  );

  protected readonly today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  protected readonly currentDay = new Date().getDate();

  // Jour du salaire principal (premier revenu avec dayOfMonth, sinon 1)
  protected readonly salaryDay = computed(() => {
    const firstIncome = this.incomes().find(e => e.dayOfMonth);
    return firstIncome?.dayOfMonth ?? 1;
  });

  // Un prélèvement est "passé" dans le cycle salaire → salaire
  // Ex: salaire le 25, aujourd'hui le 3 → passés = jours 25-31 + 1-3
  // Ex: salaire le 5, aujourd'hui le 20 → passés = jours 5-20
  protected isExpensePassed(entry: RecurringEntry): boolean {
    const day = entry.dayOfMonth ?? 1;
    const salary = this.salaryDay();
    const today = this.currentDay;

    if (today >= salary) {
      // Cycle dans le même mois : passé si entre salaryDay et today
      return day >= salary && day <= today;
    }
    // Cycle à cheval sur 2 mois : passé si >= salaryDay OU <= today
    return day >= salary || day <= today;
  }

  protected readonly selectedAccount = computed(() => {
    const id = this.selectedAccountId();
    return this.accounts().find(a => a.id === id) ?? null;
  });

  protected readonly selectedInitialBalance = computed(() =>
    Number(this.selectedAccount()?.initialBalance ?? 0)
  );

  protected readonly totalIncome = computed(() =>
    this.incomes().reduce((s, e) => s + Number(e.amount), 0)
  );
  protected readonly totalMonthlyExpenses = computed(() =>
    this.monthlyExpenses().reduce((s, e) => s + Number(e.amount), 0)
  );
  protected readonly totalAnnualExpenses = computed(() =>
    this.annualExpenses().reduce((s, e) => s + Number(e.amount), 0)
  );
  protected readonly monthlyAnnualExpenses = computed(() =>
    this.totalAnnualExpenses() / 12
  );
  protected readonly totalMonthSpendings = computed(() =>
    this.monthSpendings().reduce((s, e) => s + Number(e.amount), 0)
  );

  // Prélèvements passés/à venir dans le cycle salaire
  protected readonly passedExpenses = computed(() =>
    this.monthlyExpenses().filter(e => this.isExpensePassed(e))
  );
  protected readonly upcomingExpenses = computed(() =>
    this.monthlyExpenses().filter(e => !this.isExpensePassed(e))
  );
  protected readonly totalPassedExpenses = computed(() =>
    this.passedExpenses().reduce((s, e) => s + Number(e.amount), 0)
  );
  protected readonly totalUpcomingExpenses = computed(() =>
    this.upcomingExpenses().reduce((s, e) => s + Number(e.amount), 0)
  );

  // Virements ponctuels sortants/entrants du mois (tous considérés comme passés)
  protected readonly totalOneTimeOutgoing = computed(() => {
    const accountId = this.selectedAccountId();
    return this.monthOneTimeTransfers()
      .filter(e => e.accountId === accountId)
      .reduce((s, e) => s + Number(e.amount), 0);
  });
  protected readonly totalOneTimeIncoming = computed(() => {
    const accountId = this.selectedAccountId();
    return this.monthOneTimeTransfers()
      .filter(e => e.toAccountId === accountId)
      .reduce((s, e) => s + Number(e.amount), 0);
  });

  // Virements passés/à venir (cycle salaire pour récurrents + ponctuels du mois)
  private readonly passedOutgoing = computed(() =>
    this.outgoingTransfers().filter(e => this.isExpensePassed(e)).reduce((s, e) => s + Number(e.amount), 0)
    + this.totalOneTimeOutgoing()
  );
  private readonly passedIncoming = computed(() =>
    this.incomingTransfers().filter(e => this.isExpensePassed(e)).reduce((s, e) => s + Number(e.amount), 0)
    + this.totalOneTimeIncoming()
  );
  private readonly totalOutgoing = computed(() =>
    this.outgoingTransfers().reduce((s, e) => s + Number(e.amount), 0)
    + this.totalOneTimeOutgoing()
  );
  private readonly totalIncoming = computed(() =>
    this.incomingTransfers().reduce((s, e) => s + Number(e.amount), 0)
    + this.totalOneTimeIncoming()
  );

  protected readonly totalAllExpenses = computed(() =>
    this.totalMonthlyExpenses() + this.monthlyAnnualExpenses() + this.totalMonthSpendings() + this.totalOutgoing()
  );

  // Solde actuel = initial + revenus + virements entrants passés - prélèvements passés - virements sortants passés - annuels/12 - dépenses
  protected readonly currentBalance = computed(() =>
    this.selectedInitialBalance() + this.totalIncome() + this.passedIncoming()
    - this.totalPassedExpenses() - this.passedOutgoing()
    - this.monthlyAnnualExpenses() - this.totalMonthSpendings()
  );

  // Solde prochain salaire = initial + revenus + virements entrants - TOUTES charges - virements sortants
  protected readonly endOfMonthBalance = computed(() =>
    this.selectedInitialBalance() + this.totalIncome() + this.totalIncoming()
    - this.totalMonthlyExpenses() - this.monthlyAnnualExpenses() - this.totalMonthSpendings() - this.totalOutgoing()
  );

  protected readonly usagePercent = computed(() => {
    const income = this.totalIncome() + this.selectedInitialBalance() + this.totalIncoming();
    if (income === 0) return 0;
    return (this.totalAllExpenses() / income) * 100;
  });

  protected readonly selectedEntry = signal<RecurringEntry | null>(null);
  protected readonly createType = signal<RecurringEntryType>('income');
  protected readonly createTransferMode = signal<'recurring' | 'one_time'>('recurring');
  // Timeline du mois : tous les événements triés par cycle salaire
  protected readonly timelineEvents = computed(() => {
    const salary = this.salaryDay();
    const events: { id: string; day: number; label: string; amount: number; sign: string; type: RecurringEntryType; passed: boolean }[] = [];

    for (const e of this.incomes()) {
      if (e.dayOfMonth) events.push({ id: e.id, day: e.dayOfMonth, label: e.label, amount: Number(e.amount), sign: '+', type: 'income', passed: this.isExpensePassed(e) });
    }
    for (const e of this.monthlyExpenses()) {
      const day = e.dayOfMonth ?? 1;
      events.push({ id: e.id, day, label: e.label, amount: Number(e.amount), sign: '-', type: 'expense', passed: this.isExpensePassed(e) });
    }
    for (const e of this.outgoingTransfers()) {
      events.push({ id: e.id, day: e.dayOfMonth ?? 1, label: `→ ${this.accountNameById(e.toAccountId) ?? 'Autre'} — ${e.label}`, amount: Number(e.amount), sign: '-', type: 'transfer', passed: this.isExpensePassed(e) });
    }
    for (const e of this.incomingTransfers()) {
      events.push({ id: e.id + '-in', day: e.dayOfMonth ?? 1, label: `← ${this.accountNameById(e.accountId) ?? 'Autre'} — ${e.label}`, amount: Number(e.amount), sign: '+', type: 'transfer', passed: this.isExpensePassed(e) });
    }

    // Tri dans l'ordre du cycle salaire (salaryDay en premier)
    return events.sort((a, b) => {
      const orderA = a.day >= salary ? a.day - salary : a.day + 31 - salary;
      const orderB = b.day >= salary ? b.day - salary : b.day + 31 - salary;
      return orderA - orderB;
    });
  });

  protected readonly createModalTitle = computed(() => {
    switch (this.createType()) {
      case 'income': return 'Nouveau revenu';
      case 'expense': return 'Nouveau prélèvement mensuel';
      case 'annual_expense': return 'Nouveau prélèvement annuel';
      case 'spending': return 'Nouvelle dépense';
      case 'transfer': return this.createTransferMode() === 'one_time' ? 'Nouveau virement ponctuel' : 'Nouveau virement automatique';
    }
  });
  protected readonly editModalTitle = computed(() => {
    switch (this.selectedEntry()?.type) {
      case 'income': return 'Modifier le revenu';
      case 'expense': return 'Modifier le prélèvement mensuel';
      case 'annual_expense': return 'Modifier le prélèvement annuel';
      case 'spending': return 'Modifier la dépense';
      case 'transfer': return 'Modifier le virement';
      default: return 'Modifier';
    }
  });

  protected readonly newAccountName = signal('');
  protected readonly newAccountBalance = signal<number>(0);

  protected readonly memberMap = computed(() => {
    const map = new Map<string, { name: string; color: string }>();
    const members = this.members();
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      map.set(m.id, { name: `${m.firstName} ${m.lastName}`, color: PALETTE[(i + 3) % PALETTE.length] });
    }
    return map;
  });

  private readonly accountMap = computed(() => {
    const map = new Map<string, string>();
    for (const a of this.accounts()) {
      map.set(a.id, a.name);
    }
    return map;
  });

  protected accountName(id: string | null): string | null {
    if (!id) return null;
    if (this.selectedAccountId() !== null) return null; // pas besoin d'afficher si déjà filtré
    return this.accountMap().get(id) ?? null;
  }

  protected accountNameById(id: string | null): string | null {
    if (!id) return null;
    return this.accountMap().get(id) ?? null;
  }

  protected selectAccount(id: string | null) {
    this.selectedAccountId.set(id);
  }

  protected accountColor(index: number): string {
    return PALETTE[index % PALETTE.length];
  }

  protected accountDotColor(index: number): string {
    return PALETTE[(index + 3) % PALETTE.length];
  }

  protected prevMonth() {
    const [y, m] = this.spendingMonth().split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    this.spendingMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  protected nextMonth() {
    const [y, m] = this.spendingMonth().split('-').map(Number);
    const d = new Date(y, m, 1);
    this.spendingMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  protected resetAccountForm() {
    this.newAccountName.set('');
    this.newAccountBalance.set(0);
  }

  protected async createAccount() {
    const name = this.newAccountName().trim();
    if (!name) return;
    try {
      await lastValueFrom(this.createAccountUC.execute({ name, initialBalance: this.newAccountBalance(), color: null, dotColor: null }));
      this.toaster.success('Compte créé');
      this.resetAccountForm();
      this._refreshAccounts.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la création du compte');
    }
  }

  protected async updateAccountBalance(accountId: string, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    try {
      await lastValueFrom(this.updateAccountUC.execute(accountId, { initialBalance: value }));
      this.toaster.success('Solde initial mis à jour');
      this._refreshAccounts.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la mise à jour');
    }
  }

  protected async deleteAccount(account: BankAccountModel) {
    if (!await this.confirm.confirm({ title: 'Supprimer le compte', message: `Supprimer le compte "${account.name}" ? Les entrees seront conservees sans compte.`, confirmLabel: 'Supprimer', variant: 'danger' })) return;
    try {
      await lastValueFrom(this.deleteAccountUC.execute(account.id));
      this.toaster.success('Compte supprimé');
      if (this.selectedAccountId() === account.id) {
        this.selectedAccountId.set(null);
      }
      this._refreshAccounts.update(v => v + 1);
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la suppression du compte');
    }
  }

  protected openCreateModal(type: RecurringEntryType, transferMode: 'recurring' | 'one_time' = 'recurring') {
    this.createType.set(type);
    this.createTransferMode.set(transferMode);
    this.createModalRef().open();
  }

  protected openEditModal(entry: RecurringEntry) {
    this.selectedEntry.set(entry);
    this.editModalRef().open();
  }

  protected onModalClosed() { this.selectedEntry.set(null); }

  protected async createEntry(data: Omit<RecurringEntry, 'id'>) {
    try {
      // Si c'est un revenu et qu'il en existe déjà, demander à l'utilisateur
      if (data.type === 'income' && this.incomes().length > 0) {
        const choice = await this.confirm.choose({
          title: 'Ajouter un revenu',
          message: 'Vous avez déjà des revenus enregistrés. Souhaitez-vous démarrer un nouveau cycle (archiver les anciens) ou simplement ajouter ce revenu au mois en cours ?',
          confirmLabel: 'Nouveau cycle',
          alternativeLabel: 'Ajouter au mois',
          cancelLabel: 'Annuler',
          variant: 'info',
        });

        if (choice === 'cancel') return;

        if (choice === 'confirm') {
          await this.archiveCurrentCycle();
          for (const old of this.incomes()) {
            await lastValueFrom(this.deleteEntryUC.execute(old.id));
          }
          this.toaster.success('Cycle archivé');
        }
      }

      await lastValueFrom(this.createEntryUC.execute(data));
      this.toaster.success('Entrée créée');
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la création');
    }
  }

  private async archiveCurrentCycle() {
    const salary = this.totalIncome();
    if (salary <= 0) return;

    const month = new Date().toISOString().slice(0, 7);
    const accountId = this.selectedAccountId();
    const totalExpenses = this.totalMonthlyExpenses() + this.monthlyAnnualExpenses();
    const totalSpendings = this.totalMonthSpendings();
    const spendings = this.monthSpendings().map(e => ({
      label: e.label,
      amount: Number(e.amount),
      date: e.date,
      category: e.category,
    }));

    const fd = new FormData();
    fd.append('month', month);
    fd.append('salary', String(salary));
    fd.append('totalExpenses', String(totalExpenses));
    fd.append('totalSpendings', String(totalSpendings));
    fd.append('spendings', JSON.stringify(spendings));
    if (accountId) fd.append('accountId', accountId);

    try {
      await lastValueFrom(this.createArchiveUC.execute(fd));
    } catch {
      // L'archivage silencieux échoue — on continue quand même
    }
  }

  protected async deleteEntry(id: string) {
    if (!await this.confirm.delete('cette entrée')) return;
    try {
      await lastValueFrom(this.deleteEntryUC.execute(id));
      this.toaster.success('Entrée supprimée');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la suppression');
    }
  }

  // ── Payslip management ──

  private _pendingPayslipFile: File | null = null;

  protected uploadPayslip(file: File) {
    this._pendingPayslipFile = file;
  }

  protected async updateEntry(data: Omit<RecurringEntry, 'id'>) {
    const id = this.selectedEntry()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.updateEntryUC.execute(id, data));
      const file = this._pendingPayslipFile;
      if (file) {
        this._pendingPayslipFile = null;
        try {
          await lastValueFrom(this.entryGateway.uploadPayslip(id, file));
          this.toaster.success('Entrée modifiée');
          this.editModalRef().close();
          this._refresh.update(v => v + 1);
        } catch {
          this.toaster.error('Erreur lors de l\'ajout de la fiche de paie');
        }
      } else {
        this.toaster.success('Entrée modifiée');
        this.editModalRef().close();
        this._refresh.update(v => v + 1);
      }
    } catch {
      this.toaster.error('Erreur lors de la modification');
    }
  }

  protected openPayslip() {
    const id = this.selectedEntry()?.id;
    if (!id) return;
    this.openPayslipById(id);
  }

  protected async openPayslipById(id: string) {
    const blob = await lastValueFrom(this.entryGateway.downloadPayslip(id));
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  protected async deletePayslip() {
    const id = this.selectedEntry()?.id;
    if (!id) return;
    if (!await this.confirm.delete('la fiche de paie')) return;
    try {
      await lastValueFrom(this.entryGateway.deletePayslip(id));
      this.toaster.success('Fiche de paie supprimée');
      this._refresh.update(v => v + 1);
      const entry = this.selectedEntry();
      if (entry) {
        this.selectedEntry.set({ ...entry, payslipKey: null });
      }
    } catch {
      this.toaster.error('Erreur lors de la suppression de la fiche de paie');
    }
  }
}
