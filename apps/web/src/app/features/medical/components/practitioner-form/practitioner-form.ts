import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { Practitioner, PractitionerType } from '../../domain/models/practitioner.model';

type PractitionerFormShape = {
  name: FormControl<string>;
  type: FormControl<PractitionerType>;
  phone: FormControl<string>;
  email: FormControl<string>;
  address: FormControl<string>;
  bookingUrl: FormControl<string>;
};

const PRACTITIONER_TYPE_LABELS: Record<PractitionerType, string> = {
  generaliste: 'Generaliste',
  pediatre: 'Pediatre',
  psychiatre: 'Psychiatre',
  neurologue: 'Neurologue',
  ophtalmologue: 'Ophtalmologue',
  dentiste: 'Dentiste',
  orthodontiste: 'Orthodontiste',
  orthophoniste: 'Orthophoniste',
  psychologue: 'Psychologue',
  psychomotricien: 'Psychomotricien',
  ergotherapeute: 'Ergotherapeute',
  kinesitherapeute: 'Kinesitherapeute',
  dermatologue: 'Dermatologue',
  cardiologue: 'Cardiologue',
  autre: 'Autre',
};

@Component({
  selector: 'app-practitioner-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? 'Modifier praticien' : 'Nouveau praticien' }}</legend>

        <div>
          <label for="pract-name" class="form-label">
            Nom <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="pract-name" type="text" formControlName="name" aria-required="true"
                 class="form-input" />
          @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
            <small class="error" role="alert">Le nom est obligatoire.</small>
          }
        </div>

        <div>
          <label for="pract-type" class="form-label">
            Type <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="pract-type" formControlName="type" aria-required="true"
                  class="form-select">
            @for (entry of typeEntries; track entry.value) {
              <option [value]="entry.value">{{ entry.label }}</option>
            }
          </select>
        </div>

        <div>
          <label for="pract-phone" class="form-label">Téléphone</label>
          <input id="pract-phone" type="tel" formControlName="phone" autocomplete="tel"
                 class="form-input" />
        </div>

        <div>
          <label for="pract-email" class="form-label">Email</label>
          <input id="pract-email" type="email" formControlName="email" autocomplete="email"
                 class="form-input" />
          @if (form.controls.email.touched && form.controls.email.errors?.['email']) {
            <small class="error" role="alert">Format email invalide.</small>
          }
        </div>

        <div>
          <label for="pract-address" class="form-label">Adresse</label>
          <textarea id="pract-address" formControlName="address" rows="2"
                    class="form-input"></textarea>
        </div>

        <div>
          <label for="pract-booking" class="form-label">Lien prise de RDV</label>
          <input id="pract-booking" type="text" formControlName="bookingUrl" placeholder="https://www.doctolib.fr/..."
                 class="form-input" />
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit" style="background-color: var(--color-ib-purple)">
          {{ initial() ? 'Enregistrer' : 'Créer' }}
        </button>
      </footer>
    </form>
  `,
})
export class PractitionerForm {
  readonly initial = input<Practitioner | null>(null);
  readonly submitted = output<Omit<Practitioner, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly typeEntries = Object.entries(PRACTITIONER_TYPE_LABELS).map(
    ([value, label]) => ({ value: value as PractitionerType, label }),
  );

  protected readonly form = new FormGroup<PractitionerFormShape>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<PractitionerType>('generaliste', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    address: new FormControl('', { nonNullable: true }),
    bookingUrl: new FormControl('', { nonNullable: true }),
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
          name: data.name,
          type: data.type,
          phone: data.phone ?? '',
          email: data.email ?? '',
          address: data.address ?? '',
          bookingUrl: data.bookingUrl ?? '',
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
      name: v.name,
      type: v.type,
      phone: v.phone || null,
      email: v.email || null,
      address: v.address || null,
      bookingUrl: v.bookingUrl || null,
    });
  }
}
