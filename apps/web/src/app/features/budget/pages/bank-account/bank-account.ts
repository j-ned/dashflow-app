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
import { GetMembersUseCase } from '../../domain/use-cases/get-members.use-case';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { RecurringEntryForm } from '../../components/recurring-entry-form/recurring-entry-form';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';

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
        <p class="mt-1 text-sm text-text-muted">Estimation du solde en fin de mois</p>
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
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
        <p class="mt-1.5 text-[11px] text-text-muted">{{ incomes().length }} source{{ incomes().length > 1 ? 's' : '' }}</p>
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
        <p class="mt-1.5 text-[11px] text-text-muted">{{ monthlyExpenses().length }} prélèvement{{ monthlyExpenses().length > 1 ? 's' : '' }}/mois</p>
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

      <!-- Reste estimé -->
      <div class="group relative overflow-hidden rounded-xl border bg-surface p-5 transition-all"
           [class.border-ib-green-40]="remaining() >= 0"
           [class.border-ib-red-40]="remaining() < 0"
           [class.hover:shadow-lg]="true"
           [class.hover:shadow-ib-green-5]="remaining() >= 0"
           [class.hover:shadow-ib-red-5]="remaining() < 0">
        <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl"
             [class.bg-ib-green]="remaining() >= 0"
             [class.bg-ib-red]="remaining() < 0"></div>
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg"
               [class.bg-ib-green-10]="remaining() >= 0"
               [class.bg-ib-red-10]="remaining() < 0">
            <app-icon name="wallet" size="14"
                      [class.text-ib-green]="remaining() >= 0"
                      [class.text-ib-red]="remaining() < 0" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Reste</p>
        </div>
        <p class="text-2xl font-mono font-bold tracking-tight"
           [class.text-ib-green]="remaining() >= 0"
           [class.text-ib-red]="remaining() < 0">
          {{ remaining() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span>
        </p>
        <p class="mt-1.5 text-[11px] text-text-muted">après toutes charges</p>
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
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-red"></span> Prélèvements {{ totalMonthlyExpenses() | number:'1.0-0' }}&euro;</span>
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
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button"
                          class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors"
                          (click)="openEditModal(entry)" aria-label="Modifier">
                    <app-icon name="pencil" size="13" />
                  </button>
                  <button type="button"
                          class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                          (click)="deleteEntry(entry.id)" aria-label="Supprimer">
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
              <div class="group flex items-center justify-between py-2 hover:bg-ib-red/3 rounded-lg px-1.5 -mx-1.5 transition-colors">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-red/10 text-ib-red text-[10px] font-bold shrink-0">
                    @if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-text-primary truncate">{{ entry.label }}</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold text-ib-red">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors" (click)="openEditModal(entry)" aria-label="Modifier">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors" (click)="deleteEntry(entry.id)" aria-label="Supprimer">
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
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold text-ib-orange">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors" (click)="openEditModal(entry)" aria-label="Modifier">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors" (click)="deleteEntry(entry.id)" aria-label="Supprimer">
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
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors" (click)="openEditModal(entry)" aria-label="Modifier">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors" (click)="deleteEntry(entry.id)" aria-label="Supprimer">
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

    <!-- ═══ Modals ═══ -->
    <app-modal-dialog #accountModal title="Gestion des comptes" (closed)="newAccountName.set('')">
      @if (accountModal.isOpen()) {
        <div class="space-y-6">
          <!-- Liste des comptes existants -->
          @if (accounts().length > 0) {
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Comptes existants</p>
              <div class="rounded-xl border border-border overflow-hidden divide-y divide-border/30">
                @for (account of accounts(); track account.id; let i = $index) {
                  <div class="flex items-center justify-between px-4 py-3 hover:bg-hover/30 transition-colors">
                    <div class="flex items-center gap-3">
                      <span class="inline-flex items-center gap-2">
                        <span class="inline-block h-3 w-3 rounded-full" [style.background-color]="accountDotColor(i)"></span>
                        <span class="inline-block h-4 w-4 rounded-md" [style.background-color]="accountColor(i)"></span>
                      </span>
                      <span class="text-sm font-medium text-text-primary">{{ account.name }}</span>
                    </div>
                    <button type="button"
                            class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                            (click)="deleteAccount(account)"
                            aria-label="Supprimer le compte">
                      <app-icon name="trash" size="14" />
                    </button>
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
        <app-recurring-entry-form [forcedType]="createType()" [forcedAccountId]="selectedAccountId()" [members]="members()" (submitted)="createEntry($event)" (cancelled)="createModal.close()" />
      }
    </app-modal-dialog>

    <app-modal-dialog #editModal [title]="editModalTitle()" (closed)="onModalClosed()">
      @if (editModal.isOpen()) {
        <app-recurring-entry-form [initial]="selectedEntry()" [members]="members()"
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
  private readonly deleteAccountUC = inject(DeleteBankAccountUseCase);
  private readonly entryGateway = inject(RecurringEntryGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);

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

  protected readonly incomes = computed(() => this.filteredEntries().filter(e => e.type === 'income'));
  protected readonly monthlyExpenses = computed(() => this.filteredEntries().filter(e => e.type === 'expense'));
  protected readonly annualExpenses = computed(() => this.filteredEntries().filter(e => e.type === 'annual_expense'));
  protected readonly allSpendings = computed(() => this.filteredEntries().filter(e => e.type === 'spending'));

  protected readonly spendingMonth = signal(new Date().toISOString().slice(0, 7));

  protected readonly spendingMonthLabel = computed(() => {
    const [y, m] = this.spendingMonth().split('-');
    const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return `${MONTHS[Number(m) - 1]} ${y}`;
  });

  protected readonly monthSpendings = computed(() => {
    const ym = this.spendingMonth();
    return this.allSpendings().filter(e => {
      if (!e.date) return true; // sans date = mois courant par défaut
      return e.date.startsWith(ym);
    });
  });

  protected readonly sortedMonthlyExpenses = computed(() =>
    [...this.monthlyExpenses()].sort((a, b) => (a.dayOfMonth ?? 32) - (b.dayOfMonth ?? 32))
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
  protected readonly totalAllExpenses = computed(() =>
    this.totalMonthlyExpenses() + this.monthlyAnnualExpenses() + this.totalMonthSpendings()
  );
  protected readonly remaining = computed(() => this.totalIncome() - this.totalAllExpenses());
  protected readonly usagePercent = computed(() => {
    const income = this.totalIncome();
    if (income === 0) return 0;
    return (this.totalAllExpenses() / income) * 100;
  });

  protected readonly selectedEntry = signal<RecurringEntry | null>(null);
  protected readonly createType = signal<RecurringEntryType>('income');
  protected readonly createModalTitle = computed(() => {
    switch (this.createType()) {
      case 'income': return 'Nouveau revenu';
      case 'expense': return 'Nouveau prélèvement mensuel';
      case 'annual_expense': return 'Nouveau prélèvement annuel';
      case 'spending': return 'Nouvelle dépense';
    }
  });
  protected readonly editModalTitle = computed(() => {
    switch (this.selectedEntry()?.type) {
      case 'income': return 'Modifier le revenu';
      case 'expense': return 'Modifier le prélèvement mensuel';
      case 'annual_expense': return 'Modifier le prélèvement annuel';
      case 'spending': return 'Modifier la dépense';
      default: return 'Modifier';
    }
  });

  protected readonly newAccountName = signal('');

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
    this.spendingMonth.set(d.toISOString().slice(0, 7));
  }

  protected nextMonth() {
    const [y, m] = this.spendingMonth().split('-').map(Number);
    const d = new Date(y, m, 1);
    this.spendingMonth.set(d.toISOString().slice(0, 7));
  }

  protected async createAccount() {
    const name = this.newAccountName().trim();
    if (!name) return;
    try {
      await lastValueFrom(this.createAccountUC.execute({ name, color: null, dotColor: null }));
      this.toaster.success('Compte créé');
      this.newAccountName.set('');
      this._refreshAccounts.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la création du compte');
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

  protected openCreateModal(type: RecurringEntryType) {
    this.createType.set(type);
    this.createModalRef().open();
  }

  protected openEditModal(entry: RecurringEntry) {
    this.selectedEntry.set(entry);
    this.editModalRef().open();
  }

  protected onModalClosed() { this.selectedEntry.set(null); }

  protected async createEntry(data: Omit<RecurringEntry, 'id'>) {
    try {
      await lastValueFrom(this.createEntryUC.execute(data));
      this.toaster.success('Entrée créée');
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la création');
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
