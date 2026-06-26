import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { form, FormField, min, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Envelope, EnvelopeType } from '../../domain/models/envelope.model';
import { Member } from '../../domain/models/member.model';

type EnvelopeModel = {
  memberId: string;
  name: string;
  type: EnvelopeType;
  balance: number;
  target: number | null;
  color: string;
  dueDay: number | null;
};

const EMPTY_MODEL: EnvelopeModel = {
  memberId: '',
  name: '',
  type: 'épargne',
  balance: 0,
  target: null,
  color: '#6aab73',
  dueDay: null,
};

const ENVELOPE_COLORS = [
  '#2aacb8',
  '#6aab73',
  '#e5c07b',
  '#9876aa',
  '#56a8f5',
  '#cf8e6d',
  '#e06c75',
  '#c77dba',
] as const;

@Component({
  selector: 'app-envelope-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{
            initial()
              ? ('budget.envelope.form.editLegend' | transloco)
              : ('budget.envelope.form.createLegend' | transloco)
          }}
        </legend>

        <div>
          <label for="env-member" class="form-label">{{
            'budget.envelope.form.member' | transloco
          }}</label>
          <select id="env-member" [formField]="envelopeForm.memberId" class="form-select">
            <option value="">{{ 'budget.envelope.form.memberGlobal' | transloco }}</option>
            @for (m of members(); track m.id) {
              <option [value]="m.id">{{ m.firstName }} {{ m.lastName }}</option>
            }
          </select>
        </div>

        <div>
          <label for="env-name" class="form-label">
            {{ 'budget.envelope.form.name' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="env-name"
            type="text"
            [formField]="envelopeForm.name"
            aria-required="true"
            class="form-input"
          />
          @if (envelopeForm.name().touched() && envelopeForm.name().invalid()) {
            @for (err of envelopeForm.name().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="env-type" class="form-label">
            {{ 'budget.envelope.form.type' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="env-type" [formField]="envelopeForm.type" aria-required="true" class="form-select">
            <option value="épargne">{{ 'budget.envelope.form.typeSavings' | transloco }}</option>
            <option value="impôts">{{ 'budget.envelope.form.typeTaxes' | transloco }}</option>
            <option value="équipement">
              {{ 'budget.envelope.form.typeEquipment' | transloco }}
            </option>
            <option value="vacances">{{ 'budget.envelope.form.typeVacation' | transloco }}</option>
          </select>
        </div>

        <div>
          <label for="env-balance" class="form-label">{{
            'budget.envelope.form.initialBalance' | transloco
          }}</label>
          <input
            id="env-balance"
            type="number"
            [formField]="envelopeForm.balance"
            step="0.01"
            class="form-input mono"
          />
          @if (envelopeForm.balance().touched() && envelopeForm.balance().invalid()) {
            @for (err of envelopeForm.balance().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="env-target" class="form-label">{{
              'budget.envelope.form.objective' | transloco
            }}</label>
            <input
              id="env-target"
              type="number"
              [formField]="envelopeForm.target"
              step="0.01"
              class="form-input mono"
            />
          </div>
          <div>
            <label for="env-due-day" class="form-label">{{
              'budget.envelope.form.depositDay' | transloco
            }}</label>
            <input
              id="env-due-day"
              type="number"
              [formField]="envelopeForm.dueDay"
              [placeholder]="'budget.envelope.form.depositDayPlaceholder' | transloco"
              class="form-input mono"
            />
            <p class="text-xs mt-1 text-text-muted">
              {{ 'budget.envelope.form.depositDayHint' | transloco }}
            </p>
          </div>
        </div>

        <div>
          <span class="form-label" id="envelope-color-label">{{
            'budget.envelope.form.color' | transloco
          }}</span>
          <div role="group" aria-labelledby="envelope-color-label" class="flex gap-2 flex-wrap">
            @for (c of colors; track c) {
              <button
                type="button"
                class="h-8 w-8 rounded-full border-2 transition"
                [style.background-color]="c"
                [class.border-text-primary]="envelopeForm.color().value() === c"
                [class.border-transparent]="envelopeForm.color().value() !== c"
                [class.scale-110]="envelopeForm.color().value() === c"
                (click)="envelopeForm.color().value.set(c)"
                [attr.aria-label]="'budget.envelope.form.colorAria' | transloco: { color: c }"
              ></button>
            }
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="envelopeForm().invalid()" class="btn-submit bg-ib-green">
          {{
            initial()
              ? ('budget.envelope.form.submitEdit' | transloco)
              : ('budget.envelope.form.submitCreate' | transloco)
          }}
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

  // État dérivé modifiable : se réinitialise quand `initial` change, éditable par le form.
  protected readonly model = linkedSignal<EnvelopeModel>(() => {
    const data = this.initial();
    return data
      ? {
          memberId: data.memberId ?? '',
          name: data.name,
          type: data.type,
          balance: data.balance,
          target: data.target,
          color: data.color,
          dueDay: data.dueDay,
        }
      : { ...EMPTY_MODEL };
  });

  protected readonly envelopeForm = form(this.model, (path) => {
    required(path.name, { message: 'budget.errors.nameRequired' });
    min(path.balance, 0, { message: 'budget.errors.balanceMin' });
  });

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.envelopeForm, async () => {
      const v = this.model();
      this.submitted.emit({
        memberId: v.memberId || null,
        name: v.name,
        type: v.type,
        balance: v.balance,
        target: v.target,
        color: v.color,
        dueDay: v.dueDay ?? null,
      });
      return [];
    });
  }
}
