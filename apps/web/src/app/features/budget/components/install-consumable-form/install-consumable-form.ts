import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

type InstallFormShape = {
  installedAt: FormControl<string>;
  estimatedLifetimeDays: FormControl<number>;
};

@Component({
  selector: 'app-install-consumable-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">Installer le consommable</legend>

        <div>
          <label for="install-date" class="form-label">
            Date d'installation <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="install-date" type="date" formControlName="installedAt" aria-required="true"
                 class="form-input" />
          @if (form.controls.installedAt.touched && form.controls.installedAt.errors?.['required']) {
            <small class="error" role="alert">La date d'installation est obligatoire.</small>
          }
        </div>

        <div>
          <label for="install-lifetime" class="form-label">
            Durée estimée (jours) <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="install-lifetime" type="number" formControlName="estimatedLifetimeDays" min="1" aria-required="true"
                 class="form-input mono" />
          @if (form.controls.estimatedLifetimeDays.touched) {
            @if (form.controls.estimatedLifetimeDays.errors?.['required']) {
              <small class="error" role="alert">La durée est obligatoire.</small>
            } @else if (form.controls.estimatedLifetimeDays.errors?.['min']) {
              <small class="error" role="alert">La durée doit être d'au minimum 1 jour.</small>
            }
          }
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="form.invalid"
                class="btn-submit" style="background-color: var(--color-ib-cyan)">
          Installer
        </button>
      </footer>
    </form>
  `,
})
export class InstallConsumableForm {
  readonly submitted = output<{ installedAt: string; estimatedLifetimeDays: number }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<InstallFormShape>({
    installedAt: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    estimatedLifetimeDays: new FormControl(90, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
  });

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({ installedAt: v.installedAt, estimatedLifetimeDays: v.estimatedLifetimeDays });
    this.form.reset();
  }
}
