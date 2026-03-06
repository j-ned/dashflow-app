import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Consumable, ConsumableCategory } from '../../domain/models/consumable.model';

type ConsumableFormShape = {
  name: FormControl<string>;
  category: FormControl<ConsumableCategory>;
  quantity: FormControl<number>;
  minThreshold: FormControl<number>;
  unitPrice: FormControl<number>;
  estimatedLifetimeDays: FormControl<number | null>;
  installedAt: FormControl<string>;
};

@Component({
  selector: 'app-consumable-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? 'Modifier consommable' : 'Nouveau consommable' }}</legend>

        <div>
          <label for="cons-name" class="form-label">
            Nom <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="cons-name" type="text" formControlName="name" aria-required="true"
                 class="form-input" />
          @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
            <small class="error" role="alert">Le nom est obligatoire.</small>
          }
        </div>

        <div>
          <label for="cons-category" class="form-label">
            Catégorie <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="cons-category" formControlName="category" aria-required="true"
                  class="form-select">
            <option value="ink">Encre</option>
            <option value="toner">Toner</option>
            <option value="paper">Papier</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="cons-quantity" class="form-label">
              Quantité <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="cons-quantity" type="number" formControlName="quantity" min="0" aria-required="true"
                   class="form-input mono" />
            @if (form.controls.quantity.touched) {
              @if (form.controls.quantity.errors?.['required']) {
                <small class="error" role="alert">La quantité est obligatoire.</small>
              } @else if (form.controls.quantity.errors?.['min']) {
                <small class="error" role="alert">La quantité ne peut pas être négative.</small>
              }
            }
          </div>
          <div>
            <label for="cons-threshold" class="form-label">Seuil minimum</label>
            <input id="cons-threshold" type="number" formControlName="minThreshold" min="0"
                   class="form-input mono" />
            @if (form.controls.minThreshold.touched && form.controls.minThreshold.errors?.['min']) {
              <small class="error" role="alert">Le seuil ne peut pas être négatif.</small>
            }
          </div>
        </div>

        <div>
          <label for="cons-price" class="form-label">
            Prix unitaire <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="cons-price" type="number" formControlName="unitPrice" step="0.01" min="0" aria-required="true"
                 class="form-input mono" />
          @if (form.controls.unitPrice.touched) {
            @if (form.controls.unitPrice.errors?.['required']) {
              <small class="error" role="alert">Le prix est obligatoire.</small>
            } @else if (form.controls.unitPrice.errors?.['min']) {
              <small class="error" role="alert">Le prix ne peut pas être négatif.</small>
            }
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="cons-lifetime" class="form-label">Durée de vie (jours)</label>
            <input id="cons-lifetime" type="number" formControlName="estimatedLifetimeDays" min="1"
                   class="form-input mono" />
          </div>
          <div>
            <label for="cons-installed" class="form-label">Date installation</label>
            <input id="cons-installed" type="date" formControlName="installedAt"
                   class="form-input" />
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="form.invalid"
                class="btn-submit" style="background-color: var(--color-ib-green)">
          {{ initial() ? 'Enregistrer' : 'Créer' }}
        </button>
      </footer>
    </form>
  `,
})
export class ConsumableForm {
  readonly initial = input<Consumable | null>(null);
  readonly submitted = output<Omit<Consumable, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<ConsumableFormShape>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl<ConsumableCategory>('ink', { nonNullable: true }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    minThreshold: new FormControl(1, { nonNullable: true, validators: [Validators.min(0)] }),
    unitPrice: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    estimatedLifetimeDays: new FormControl<number | null>(null),
    installedAt: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          minThreshold: data.minThreshold,
          unitPrice: data.unitPrice,
          estimatedLifetimeDays: data.estimatedLifetimeDays,
          installedAt: data.installedAt ?? '',
        });
      } else {
        this.form.reset();
      }
    });
  }

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const init = this.initial();
    this.submitted.emit({
      name: v.name,
      category: v.category,
      quantity: v.quantity,
      minThreshold: v.minThreshold,
      unitPrice: v.unitPrice,
      lastRestocked: init?.lastRestocked ?? new Date().toISOString().slice(0, 10),
      installedAt: v.installedAt || null,
      estimatedLifetimeDays: v.estimatedLifetimeDays,
    });
  }
}
