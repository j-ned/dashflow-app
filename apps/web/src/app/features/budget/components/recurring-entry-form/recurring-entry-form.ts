import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RecurringEntry, RecurringEntryType } from '../../domain/models/recurring-entry.model';
import { Member } from '../../domain/models/member.model';
import { Icon } from '@shared/components/icon/icon';

type RecurringEntryFormShape = {
  label: FormControl<string>;
  amount: FormControl<number>;
  type: FormControl<RecurringEntryType>;
  dayOfMonth: FormControl<number | null>;
  date: FormControl<string>;
  category: FormControl<string>;
  memberId: FormControl<string>;
};

@Component({
  selector: 'app-recurring-entry-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DecimalPipe, Icon],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
      <fieldset class="space-y-4">
        <legend class="sr-only">Entrée récurrente</legend>

        <div>
          <label for="re-label" class="block text-sm font-medium text-text-muted mb-1">Libellé <span aria-hidden="true">*</span></label>
          <input id="re-label" type="text" formControlName="label" aria-required="true"
                 class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                 [placeholder]="labelPlaceholder()" />
          @if (form.controls.label.touched && form.controls.label.errors?.['required']) {
            <small class="mt-1 block text-xs text-ib-red" role="alert">Le libellé est obligatoire.</small>
          }
        </div>

        <div>
          <label for="re-amount" class="block text-sm font-medium text-text-muted mb-1">Montant <span aria-hidden="true">*</span></label>
          <input id="re-amount" type="number" formControlName="amount" step="0.01" min="0" aria-required="true"
                 class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                 placeholder="0.00" />
          @if (form.controls.amount.touched) {
            @if (form.controls.amount.errors?.['required']) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">Le montant est obligatoire.</small>
            } @else if (form.controls.amount.errors?.['min']) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">Le montant doit être supérieur à 0.</small>
            }
          }
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="re-day" class="block text-sm font-medium text-text-muted mb-1">Jour du mois</label>
            <input id="re-day" type="number" formControlName="dayOfMonth" min="1" max="31"
                   class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                   placeholder="Ex: 5" />
            <p class="mt-1 text-xs text-text-muted">Jour récurrent</p>
          </div>
          <div>
            <label for="re-date" class="block text-sm font-medium text-text-muted mb-1">Date exacte</label>
            <input id="re-date" type="date" formControlName="date"
                   class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary" />
            <p class="mt-1 text-xs text-text-muted">Date de réception</p>
          </div>
        </div>

        <div>
          <label for="re-category" class="block text-sm font-medium text-text-muted mb-1">Catégorie</label>
          <input id="re-category" type="text" formControlName="category"
                 class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                 placeholder="Ex: Logement, Abonnement..." />
        </div>

        @if (members().length > 0) {
          <div>
            <label for="re-member" class="block text-sm font-medium text-text-muted mb-1">Membre</label>
            <select id="re-member" formControlName="memberId"
                    class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary">
              <option value="">Aucun (global)</option>
              @for (m of members(); track m.id) {
                <option [value]="m.id">{{ m.firstName }} {{ m.lastName }}</option>
              }
            </select>
          </div>
        }

        <!-- Drag & drop fiche de paie (income only, edit mode) -->
        @if (showPayslipZone()) {
          <div>
            <label class="block text-sm font-medium text-text-muted mb-1">Fiche de paie</label>

            @if (hasExistingPayslip() && !_pendingFile()) {
              <div class="flex items-center justify-between rounded-lg border border-ib-green/30 bg-ib-green/5 px-3 py-2">
                <div class="flex items-center gap-2 text-sm text-ib-green">
                  <app-icon name="file-text" size="16" />
                  <span>Fiche de paie jointe</span>
                </div>
                <div class="flex gap-2">
                  <button type="button"
                          class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:text-ib-cyan hover:border-ib-cyan/30 transition-colors"
                          (click)="viewPayslip.emit()">
                    Voir
                  </button>
                  <button type="button"
                          class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                          (click)="removePayslip.emit()">
                    Supprimer
                  </button>
                </div>
              </div>
            } @else {
              <div class="relative rounded-lg border-2 border-dashed transition-colors"
                   [class.border-ib-cyan]="isDragging()"
                   [class.bg-ib-cyan-5]="isDragging()"
                   [class.border-border]="!isDragging()"
                   (dragover)="onDragOver($event)"
                   (dragleave)="onDragLeave()"
                   (drop)="onDrop($event)">
                <input type="file"
                       accept=".pdf,.jpg,.jpeg,.png,.webp"
                       class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                       (change)="onFileInput($event)" />
                <div class="flex flex-col items-center py-6 pointer-events-none">
                  @if (_pendingFile()) {
                    <app-icon name="file-text" size="24" class="text-ib-green mb-1" />
                    <p class="text-sm font-medium text-ib-green">{{ _pendingFile()!.name }}</p>
                    <p class="text-xs text-text-muted mt-0.5">{{ (_pendingFile()!.size / 1024) | number:'1.0-0' }} Ko</p>
                  } @else {
                    <app-icon name="file-text" size="24" class="text-text-muted mb-1" />
                    <p class="text-sm text-text-muted">Glissez-déposez votre fiche de paie ici</p>
                    <p class="text-xs text-text-muted mt-0.5">ou cliquez pour parcourir (PDF, JPG, PNG)</p>
                  }
                </div>
              </div>
            }
          </div>
        }
      </fieldset>

      <footer class="flex justify-end gap-3 pt-2">
        <button type="button"
                class="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
                (click)="cancelled.emit()">
          Annuler
        </button>
        <button type="submit" [disabled]="form.invalid"
                class="rounded-lg bg-ib-green px-4 py-2 text-sm font-medium text-white hover:bg-ib-green/90 transition-colors disabled:opacity-50">
          {{ initial() ? 'Modifier' : 'Ajouter' }}
        </button>
      </footer>
    </form>
  `,
})
export class RecurringEntryForm {
  readonly initial = input<RecurringEntry | null>(null);
  readonly forcedType = input<RecurringEntryType | null>(null);
  readonly forcedAccountId = input<string | null>(null);
  readonly members = input<Member[]>([]);
  readonly submitted = output<Omit<RecurringEntry, 'id'>>();
  readonly fileAttached = output<File>();
  readonly viewPayslip = output<void>();
  readonly removePayslip = output<void>();
  readonly cancelled = output<void>();

  protected readonly isDragging = signal(false);
  protected readonly _pendingFile = signal<File | null>(null);

  protected readonly showPayslipZone = computed(() => {
    const type = this.forcedType() ?? this.initial()?.type;
    return type === 'income' && this.initial() !== null;
  });

  protected readonly hasExistingPayslip = computed(() => !!this.initial()?.payslipKey);

  protected readonly labelPlaceholder = computed(() => {
    const type = this.forcedType();
    switch (type) {
      case 'income': return 'Ex: Salaire, Prime...';
      case 'expense': return 'Ex: Loyer, Netflix, EDF...';
      case 'annual_expense': return 'Ex: Assurance auto, Impôts fonciers...';
      case 'spending': return 'Ex: Courses, Gasoil, Pain...';
      default: return 'Ex: Libellé...';
    }
  });

  protected readonly form = new FormGroup<RecurringEntryFormShape>({
    label: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
    type: new FormControl<RecurringEntryType>('expense', { nonNullable: true }),
    dayOfMonth: new FormControl<number | null>(null),
    date: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
    memberId: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          label: data.label,
          amount: data.amount,
          type: data.type,
          dayOfMonth: data.dayOfMonth,
          date: data.date ?? '',
          category: data.category ?? '',
          memberId: data.memberId ?? '',
        });
      } else {
        this.form.reset();
        const ft = this.forcedType();
        if (ft) {
          this.form.controls.type.setValue(ft);
        }
      }
      this._pendingFile.set(null);
    });
  }

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  protected onDragLeave() {
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files[0];
    if (file) {
      this._pendingFile.set(file);
    }
  }

  protected onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this._pendingFile.set(file);
    }
  }

  protected submit() {
    if (this.form.invalid) return;

    const pending = this._pendingFile();
    if (pending) {
      this.fileAttached.emit(pending);
    }

    const v = this.form.getRawValue();
    this.submitted.emit({
      label: v.label,
      amount: v.amount,
      type: v.type,
      dayOfMonth: v.dayOfMonth || null,
      date: v.date || null,
      category: v.category || null,
      memberId: v.memberId || null,
      accountId: this.initial()?.accountId ?? this.forcedAccountId() ?? null,
      payslipKey: this.initial()?.payslipKey ?? null,
    });
  }
}
