import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { form, FormField, min, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';

type RefillModel = {
  quantity: number;
};

@Component({
  selector: 'app-refill-medication-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ 'medical.medication.refill.legend' | transloco }}</legend>

        <div>
          <label for="refill-quantity" class="form-label">
            {{ 'medical.medication.refill.quantity' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="refill-quantity"
            type="number"
            [formField]="refillForm.quantity"
            aria-required="true"
            class="form-input mono"
          />
          @if (refillForm.quantity().touched() && refillForm.quantity().invalid()) {
            @for (err of refillForm.quantity().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="refillForm().invalid()" class="btn-submit bg-ib-purple">
          {{ 'medical.medication.refill.submit' | transloco }}
        </button>
      </footer>
    </form>
  `,
})
export class RefillMedicationForm {
  readonly submitted = output<{ quantity: number }>();
  readonly cancelled = output<void>();

  protected readonly model = signal<RefillModel>({ quantity: 1 });

  protected readonly refillForm = form(this.model, (path) => {
    required(path.quantity, { message: 'medical.medication.refill.quantityRequired' });
    min(path.quantity, 1, { message: 'medical.medication.refill.quantityMin' });
  });

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.refillForm, async () => {
      const v = this.model();
      this.submitted.emit({ quantity: v.quantity });
      this.model.set({ quantity: 1 });
      return [];
    });
  }
}
