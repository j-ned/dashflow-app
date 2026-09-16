import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { lastValueFrom } from 'rxjs';
import { BankAccountGateway } from '@features/budget/domain/gateways/bank-account.gateway';
import { MemberGateway } from '@features/budget/domain/gateways/member.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import {
  BANK_ACCOUNT_TYPES,
  BankAccountType,
} from '@features/budget/domain/models/bank-account.model';
import { Toaster } from '@shared/components/toast/toast';

export type OnboardingStep = 1 | 2 | 3 | 4;

type EntryDraft = {
  label: string;
  amount: string;
  type: 'income' | 'expense';
  dayOfMonth: number;
};

const STEPS: readonly OnboardingStep[] = [1, 2, 3, 4];
const DEFAULT_ENTRIES: readonly EntryDraft[] = [
  { label: '', amount: '', type: 'income', dayOfMonth: 1 },
  { label: '', amount: '', type: 'expense', dayOfMonth: 5 },
  { label: '', amount: '', type: 'expense', dayOfMonth: 10 },
];

/**
 * Premier contact : quatre écrans courts (qui vit avec vous → votre compte → vos revenus et
 * charges → protégez vos données) au lieu d'un écran de cryptographie brut devant un tableau
 * de bord vide. Les données des étapes 1 à 3 sont créées en clair puis chiffrées par l'étape 4
 * (le flux d'activation migre tout ce qui existe). Un compte qui a déjà des données saute à 4.
 */
@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe],
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <main class="w-full max-w-2xl">
      <article class="w-full rounded-xl border border-border bg-surface p-8 shadow-lg sm:p-10">
        <header class="mb-8">
          <p class="text-xs font-semibold uppercase tracking-wider text-ib-blue">
            {{ 'auth.onboarding.eyebrow' | transloco: { step: step(), total: 4 } }}
          </p>
          <ol class="mt-3 grid grid-cols-4 gap-2" aria-label="Étapes">
            @for (s of steps; track s) {
              <li class="flex flex-col gap-1.5">
                <span
                  class="h-1.5 rounded-full"
                  [class.bg-ib-blue]="s <= step()"
                  [class.bg-border]="s > step()"
                  aria-hidden="true"
                ></span>
                <span
                  class="text-[11px] leading-tight"
                  [class.text-text-primary]="s === step()"
                  [class.text-text-muted]="s !== step()"
                  [attr.aria-current]="s === step() ? 'step' : null"
                >
                  {{ 'auth.onboarding.steps.' + s | transloco }}
                </span>
              </li>
            }
          </ol>
        </header>

        @switch (step()) {
          @case (1) {
            <h1 class="text-2xl font-bold text-text-primary">
              {{ 'auth.onboarding.members.title' | transloco }}
            </h1>
            <p class="mt-2 text-sm text-text-muted">
              {{ 'auth.onboarding.members.explain' | transloco }}
            </p>
            <ul class="mt-6 space-y-2" data-testid="onboarding-members">
              @for (name of members(); track $index; let i = $index) {
                <li class="flex gap-2">
                  <input
                    type="text"
                    [attr.aria-label]="'auth.onboarding.members.placeholder' | transloco"
                    [placeholder]="'auth.onboarding.members.placeholder' | transloco"
                    [ngModel]="name"
                    (ngModelChange)="setMember(i, $event)"
                    [name]="'member-' + i"
                    maxlength="255"
                    autocomplete="given-name"
                    class="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                  />
                  @if (members().length > 1) {
                    <button
                      type="button"
                      (click)="removeMember(i)"
                      class="rounded-lg px-3 text-sm text-text-muted hover:bg-hover hover:text-ib-red"
                      [attr.aria-label]="'common.delete' | transloco"
                    >
                      ✕
                    </button>
                  }
                </li>
              }
            </ul>
            <button
              type="button"
              (click)="addMember()"
              class="mt-3 text-sm font-medium text-ib-blue hover:underline"
            >
              + {{ 'auth.onboarding.members.add' | transloco }}
            </button>
            <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                (click)="skipMembers()"
                class="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
              >
                {{ 'auth.onboarding.members.solo' | transloco }}
              </button>
              <button
                type="button"
                (click)="submitMembers()"
                [disabled]="loading() || filledMembers().length === 0"
                class="inline-flex items-center justify-center rounded-lg bg-ib-blue px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ 'auth.onboarding.next' | transloco }}
              </button>
            </div>
          }

          @case (2) {
            <h1 class="text-2xl font-bold text-text-primary">
              {{ 'auth.onboarding.account.title' | transloco }}
            </h1>
            <p class="mt-2 text-sm text-text-muted">
              {{ 'auth.onboarding.account.explain' | transloco }}
            </p>
            <form class="mt-6 grid gap-4 sm:grid-cols-2" (ngSubmit)="submitAccount()">
              <div class="sm:col-span-2">
                <label
                  for="ob-account-name"
                  class="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  {{ 'auth.onboarding.account.name' | transloco }}
                </label>
                <input
                  id="ob-account-name"
                  type="text"
                  name="accountName"
                  [ngModel]="accountName()"
                  (ngModelChange)="accountName.set($event)"
                  maxlength="255"
                  required
                  class="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                />
              </div>
              <div>
                <label
                  for="ob-account-type"
                  class="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  {{ 'auth.onboarding.account.type' | transloco }}
                </label>
                <select
                  id="ob-account-type"
                  name="accountType"
                  [ngModel]="accountType()"
                  (ngModelChange)="accountType.set($event)"
                  class="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                >
                  @for (t of accountTypes; track t) {
                    <option [value]="t">
                      {{ 'auth.onboarding.account.types.' + t | transloco }}
                    </option>
                  }
                </select>
              </div>
              <div>
                <label
                  for="ob-account-balance"
                  class="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  {{ 'auth.onboarding.account.balance' | transloco }}
                </label>
                <input
                  id="ob-account-balance"
                  type="number"
                  step="0.01"
                  inputmode="decimal"
                  name="accountBalance"
                  [ngModel]="accountBalance()"
                  (ngModelChange)="accountBalance.set($event)"
                  placeholder="0,00"
                  class="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                />
                <p class="mt-1 text-xs text-text-muted">
                  {{ 'auth.onboarding.account.balanceHint' | transloco }}
                </p>
              </div>
              <div class="sm:col-span-2 mt-4 flex justify-end">
                <button
                  type="submit"
                  [disabled]="loading() || !accountName().trim()"
                  class="inline-flex items-center justify-center rounded-lg bg-ib-blue px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {{ 'auth.onboarding.next' | transloco }}
                </button>
              </div>
            </form>
          }

          @case (3) {
            <h1 class="text-2xl font-bold text-text-primary">
              {{ 'auth.onboarding.entries.title' | transloco }}
            </h1>
            <p class="mt-2 text-sm text-text-muted">
              {{ 'auth.onboarding.entries.explain' | transloco }}
            </p>
            <ul class="mt-6 space-y-3" data-testid="onboarding-entries">
              @for (e of entries(); track $index; let i = $index) {
                <li class="grid grid-cols-12 gap-2">
                  <select
                    [attr.aria-label]="'auth.onboarding.entries.type' | transloco"
                    [ngModel]="e.type"
                    (ngModelChange)="setEntry(i, { type: $event })"
                    [name]="'entry-type-' + i"
                    class="col-span-4 rounded-lg border border-border bg-canvas px-2 py-2.5 text-sm text-text-primary sm:col-span-3"
                  >
                    <option value="income">
                      {{ 'auth.onboarding.entries.income' | transloco }}
                    </option>
                    <option value="expense">
                      {{ 'auth.onboarding.entries.expense' | transloco }}
                    </option>
                  </select>
                  <input
                    type="text"
                    [attr.aria-label]="'auth.onboarding.entries.label' | transloco"
                    [placeholder]="
                      (e.type === 'income'
                        ? 'auth.onboarding.entries.incomePlaceholder'
                        : 'auth.onboarding.entries.expensePlaceholder'
                      ) | transloco
                    "
                    [ngModel]="e.label"
                    (ngModelChange)="setEntry(i, { label: $event })"
                    [name]="'entry-label-' + i"
                    maxlength="255"
                    class="col-span-8 rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm text-text-primary sm:col-span-5"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputmode="decimal"
                    [attr.aria-label]="'auth.onboarding.entries.amount' | transloco"
                    placeholder="€"
                    [ngModel]="e.amount"
                    (ngModelChange)="setEntry(i, { amount: $event })"
                    [name]="'entry-amount-' + i"
                    class="col-span-7 rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm tabular-nums text-text-primary sm:col-span-2"
                  />
                  <input
                    type="number"
                    min="1"
                    max="31"
                    [attr.aria-label]="'auth.onboarding.entries.day' | transloco"
                    [ngModel]="e.dayOfMonth"
                    (ngModelChange)="setEntry(i, { dayOfMonth: $event })"
                    [name]="'entry-day-' + i"
                    class="col-span-5 rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm tabular-nums text-text-primary sm:col-span-2"
                  />
                </li>
              }
            </ul>
            <button
              type="button"
              (click)="addEntry()"
              class="mt-3 text-sm font-medium text-ib-blue hover:underline"
            >
              + {{ 'auth.onboarding.entries.add' | transloco }}
            </button>
            <div class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                (click)="skipEntries()"
                class="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
              >
                {{ 'auth.onboarding.skip' | transloco }}
              </button>
              <button
                type="button"
                (click)="submitEntries()"
                [disabled]="loading() || validEntries().length === 0"
                class="inline-flex items-center justify-center rounded-lg bg-ib-blue px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                {{ 'auth.onboarding.next' | transloco }}
              </button>
            </div>
          }

          @case (4) {
            <h1 class="text-2xl font-bold text-text-primary">
              {{ 'auth.onboarding.protect.title' | transloco }}
            </h1>
            <p class="mt-2 text-sm text-text-muted">
              {{
                (hasExistingData()
                  ? 'auth.onboarding.protect.existingData'
                  : 'auth.onboarding.protect.explain'
                ) | transloco
              }}
            </p>
            <ul class="mt-6 space-y-3 text-sm text-text-primary">
              <li class="flex gap-3">
                <span class="mt-0.5 text-ib-green" aria-hidden="true">●</span>
                {{ 'auth.onboarding.protect.point1' | transloco }}
              </li>
              <li class="flex gap-3">
                <span class="mt-0.5 text-ib-green" aria-hidden="true">●</span>
                {{ 'auth.onboarding.protect.point2' | transloco }}
              </li>
              <li class="flex gap-3">
                <span class="mt-0.5 text-ib-orange" aria-hidden="true">●</span>
                {{ 'auth.onboarding.protect.point3' | transloco }}
              </li>
            </ul>
            <div class="mt-8 flex justify-end">
              <button
                type="button"
                (click)="protect()"
                class="inline-flex items-center justify-center rounded-lg bg-ib-blue px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="onboarding-protect"
              >
                {{ 'auth.onboarding.protect.cta' | transloco }}
              </button>
            </div>
          }
        }
      </article>
    </main>
  `,
})
export class Onboarding {
  private readonly memberGateway = inject(MemberGateway);
  private readonly accountGateway = inject(BankAccountGateway);
  private readonly entryGateway = inject(RecurringEntryGateway);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly steps = STEPS;
  protected readonly accountTypes = BANK_ACCOUNT_TYPES;

  protected readonly step = signal<OnboardingStep>(1);
  protected readonly loading = signal(false);
  protected readonly hasExistingData = signal(false);

  protected readonly members = signal<string[]>(['', '']);
  protected readonly filledMembers = computed(() =>
    this.members()
      .map((m) => m.trim())
      .filter(Boolean),
  );

  protected readonly accountName = signal('');
  protected readonly accountType = signal<BankAccountType>('courant');
  protected readonly accountBalance = signal<string | number>('');
  private _accountId: string | null = null;

  protected readonly entries = signal<EntryDraft[]>([...DEFAULT_ENTRIES]);
  protected readonly validEntries = computed(() =>
    this.entries().filter((e) => e.label.trim() && Number(e.amount) > 0),
  );

  constructor() {
    void this.detectExistingData();
  }

  /** Un compte qui a déjà des données (ancien compte, second appareil) n'a que la protection à faire. */
  private async detectExistingData(): Promise<void> {
    try {
      const accounts = await lastValueFrom(this.accountGateway.getAll());
      if (accounts.length > 0) {
        this.hasExistingData.set(true);
        this.step.set(4);
      }
    } catch {
      /* hors ligne ou API en retard : on déroule l'onboarding normalement */
    }
  }

  // ── Étape 1 : membres ──
  protected setMember(index: number, value: string): void {
    this.members.update((list) => list.map((m, i) => (i === index ? value : m)));
  }
  protected addMember(): void {
    this.members.update((list) => [...list, '']);
  }
  protected removeMember(index: number): void {
    this.members.update((list) => list.filter((_, i) => i !== index));
  }
  protected skipMembers(): void {
    this.step.set(2);
  }
  protected async submitMembers(): Promise<void> {
    await this.run(async () => {
      for (const firstName of this.filledMembers()) {
        await lastValueFrom(this.memberGateway.create({ firstName, lastName: '', color: null }));
      }
      this.step.set(2);
    });
  }

  // ── Étape 2 : compte principal ──
  protected async submitAccount(): Promise<void> {
    const name = this.accountName().trim();
    if (!name) return;
    await this.run(async () => {
      const balance = Number(this.accountBalance());
      const created = await lastValueFrom(
        this.accountGateway.create({
          name,
          type: this.accountType(),
          initialBalance: Number.isFinite(balance) ? balance : 0,
          color: null,
          dotColor: null,
        }),
      );
      this._accountId = created.id;
      this.step.set(3);
    });
  }

  // ── Étape 3 : revenus et charges fixes ──
  protected setEntry(index: number, patch: Partial<EntryDraft>): void {
    this.entries.update((list) => list.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  protected addEntry(): void {
    this.entries.update((list) => [
      ...list,
      { label: '', amount: '', type: 'expense', dayOfMonth: 1 },
    ]);
  }
  protected skipEntries(): void {
    this.step.set(4);
  }
  protected async submitEntries(): Promise<void> {
    await this.run(async () => {
      for (const e of this.validEntries()) {
        const day = Math.min(31, Math.max(1, Math.round(Number(e.dayOfMonth)) || 1));
        await lastValueFrom(
          this.entryGateway.create({
            memberId: null,
            accountId: this._accountId,
            toAccountId: null,
            label: e.label.trim(),
            amount: Number(e.amount),
            type: e.type,
            dayOfMonth: day,
            date: null,
            endDate: null,
            category: null,
            payslipKey: null,
            autoPost: false,
            autoPostSince: null,
          }),
        );
      }
      this.step.set(4);
    });
  }

  // ── Étape 4 : protection (flux d'activation existant, qui chiffre ce qui vient d'être créé) ──
  protected protect(): void {
    void this.router.navigate(['/auth/encryption-setup'], { replaceUrl: true });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.loading.set(true);
    try {
      await action();
    } catch {
      this.toaster.error('auth.onboarding.error');
    } finally {
      this.loading.set(false);
    }
  }
}
