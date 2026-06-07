import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { Envelope, EnvelopeType } from '../../domain/models/envelope.model';
import { Member } from '../../domain/models/member.model';

type EnvelopeFormShape = {
  memberId: FormControl<string>;
  name: FormControl<string>;
  type: FormControl<EnvelopeType>;
  balance: FormControl<number>;
  target: FormControl<number | null>;
  color: FormControl<string>;
  dueDay: FormControl<number | null>;
};

const ENVELOPE_COLORS = [
  '#2aacb8', '#6aab73', '#e5c07b', '#9876aa', '#56a8f5', '#cf8e6d', '#e06c75', '#c77dba',
] as const;

@Component({
  selector: 'app-envelope-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? ('budget.envelope.form.editLegend' | transloco) : ('budget.envelope.form.createLegend' | transloco) }}</legend>

        <div>
          <label for="env-member" class="form-label">{{ 'budget.envelope.form.member' | transloco }}</label>
          <select id="env-member" formControlName="memberId" class="form-select">
            <option value="">{{ 'budget.envelope.form.memberGlobal' | transloco }}</option>
            @for (m of members(); track m.id) {
              <option [value]="m.id">{{ m.firstName }} {{ m.lastName }}</option>
            }
          </select>
        </div>

        <div>
          <label for="env-name" class="form-label">
            {{ 'budget.envelope.form.name' | transloco }} <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="env-name" type="text" formControlName="name" aria-required="true"
                 class="form-input" />
          @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
            <small class="error" role="alert">{{ 'budget.errors.nameRequired' | transloco }}</small>
          }
        </div>

        <div>
          <label for="env-type" class="form-label">
            {{ 'budget.envelope.form.type' | transloco }} <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="env-type" formControlName="type" aria-required="true"
                  class="form-select">
            <option value="épargne">{{ 'budget.envelope.form.typeSavings' | transloco }}</option>
            <option value="impôts">{{ 'budget.envelope.form.typeTaxes' | transloco }}</option>
            <option value="équipement">{{ 'budget.envelope.form.typeEquipment' | transloco }}</option>
            <option value="vacances">{{ 'budget.envelope.form.typeVacation' | transloco }}</option>
          </select>
        </div>

        <div>
          <label for="env-balance" class="form-label">{{ 'budget.envelope.form.initialBalance' | transloco }}</label>
          <input id="env-balance" type="number" formControlName="balance" step="0.01" min="0"
                 class="form-input mono" />
          @if (form.controls.balance.touched && form.controls.balance.errors?.['min']) {
            <small class="error" role="alert">{{ 'budget.errors.balanceMin' | transloco }}</small>
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="env-target" class="form-label">{{ 'budget.envelope.form.objective' | transloco }}</label>
            <input id="env-target" type="number" formControlName="target" step="0.01" min="0"
                   class="form-input mono" />
          </div>
          <div>
            <label for="env-due-day" class="form-label">{{ 'budget.envelope.form.depositDay' | transloco }}</label>
            <input id="env-due-day" type="number" formControlName="dueDay" min="1" max="31"
                   [placeholder]="'budget.envelope.form.depositDayPlaceholder' | transloco" class="form-input mono" />
            <p class="text-xs mt-1 text-text-muted">{{ 'budget.envelope.form.depositDayHint' | transloco }}</p>
          </div>
        </div>

        <div>
          <span class="form-label" id="envelope-color-label">{{ 'budget.envelope.form.color' | transloco }}</span>
          <div role="group" aria-labelledby="envelope-color-label" class="flex gap-2 flex-wrap">
            @for (c of colors; track c) {
              <button type="button"
                      class="h-8 w-8 rounded-full border-2 transition"
                      [style.background-color]="c"
                      [class.border-text-primary]="form.controls.color.value === c"
                      [class.border-transparent]="form.controls.color.value !== c"
                      [class.scale-110]="form.controls.color.value === c"
                      (click)="form.controls.color.setValue(c)"
                      [attr.aria-label]="'budget.envelope.form.colorAria' | transloco: { color: c }">
              </button>
            }
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">{{ 'common.cancel' | transloco }}</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit bg-ib-green">
          {{ initial() ? ('budget.envelope.form.submitEdit' | transloco) : ('budget.envelope.form.submitCreate' | transloco) }}
        </button>
      </footer>
    </form>
  `,
})
export class EnvelopeForm {
  readonly initial = input<Envelope | null>(null);
  readonly members = input<Member[]>([]);
  readonly submitted = output<Omit<Envelope, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly colors = ENVELOPE_COLORS;

  protected readonly form = new FormGroup<EnvelopeFormShape>({
    memberId: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<EnvelopeType>('épargne', { nonNullable: true }),
    balance: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    target: new FormControl<number | null>(null),
    dueDay: new FormControl<number | null>(null),
    color: new FormControl('#6aab73', { nonNullable: true }),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          memberId: data.memberId ?? '',
          name: data.name,
          type: data.type,
          balance: data.balance,
          target: data.target,
          dueDay: data.dueDay,
          color: data.color,
        });
      } else {
        this.form.reset();
      }
    });
  }

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      memberId: v.memberId || null,
      name: v.name,
      type: v.type,
      balance: v.balance,
      target: v.target,
      color: v.color,
      dueDay: v.dueDay ?? null,
    });
  }
}
