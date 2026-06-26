import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Practitioner, PractitionerType } from '../../domain/models/practitioner.model';

type PractitionerFormModel = {
  name: string;
  type: PractitionerType;
  phone: string;
  email: string;
  address: string;
  bookingUrl: string;
};

const EMPTY_MODEL: PractitionerFormModel = {
  name: '',
  type: 'generaliste',
  phone: '',
  email: '',
  address: '',
  bookingUrl: '',
};

const PRACTITIONER_TYPES: PractitionerType[] = [
  'generaliste',
  'pediatre',
  'psychiatre',
  'neurologue',
  'ophtalmologue',
  'dentiste',
  'orthodontiste',
  'orthophoniste',
  'psychologue',
  'psychomotricien',
  'ergotherapeute',
  'kinesitherapeute',
  'dermatologue',
  'cardiologue',
  'autre',
];

@Component({
  selector: 'app-practitioner-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{
            (initial()
              ? 'medical.practitioner.form.legendEdit'
              : 'medical.practitioner.form.legendCreate'
            ) | transloco
          }}
        </legend>

        <div>
          <label for="pract-name" class="form-label">
            {{ 'medical.practitioner.form.name' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="pract-name"
            type="text"
            [formField]="practitionerForm.name"
            aria-required="true"
            class="form-input"
          />
          @if (practitionerForm.name().touched() && practitionerForm.name().invalid()) {
            @for (err of practitionerForm.name().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="pract-type" class="form-label">
            {{ 'medical.practitioner.form.type' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select
            id="pract-type"
            [formField]="practitionerForm.type"
            aria-required="true"
            class="form-select"
          >
            @for (entry of practitionerTypes; track entry) {
              <option [value]="entry">
                {{ 'medical.practitioner.types.' + entry | transloco }}
              </option>
            }
          </select>
        </div>

        <div>
          <label for="pract-phone" class="form-label">{{
            'medical.practitioner.form.phone' | transloco
          }}</label>
          <input
            id="pract-phone"
            type="tel"
            [formField]="practitionerForm.phone"
            autocomplete="tel"
            class="form-input"
          />
        </div>

        <div>
          <label for="pract-email" class="form-label">{{
            'medical.practitioner.form.email' | transloco
          }}</label>
          <input
            id="pract-email"
            type="email"
            [formField]="practitionerForm.email"
            autocomplete="email"
            class="form-input"
          />
          @if (practitionerForm.email().touched() && practitionerForm.email().invalid()) {
            @for (err of practitionerForm.email().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="pract-address" class="form-label">{{
            'medical.practitioner.form.address' | transloco
          }}</label>
          <textarea
            id="pract-address"
            [formField]="practitionerForm.address"
            rows="2"
            class="form-input"
          ></textarea>
        </div>

        <div>
          <label for="pract-booking" class="form-label">{{
            'medical.practitioner.form.bookingUrl' | transloco
          }}</label>
          <input
            id="pract-booking"
            type="text"
            [formField]="practitionerForm.bookingUrl"
            placeholder="https://www.doctolib.fr/..."
            class="form-input"
          />
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          type="submit"
          [disabled]="practitionerForm().invalid()"
          class="btn-submit bg-ib-purple"
        >
          {{
            (initial() ? 'medical.practitioner.form.save' : 'medical.practitioner.form.create')
              | transloco
          }}
        </button>
      </footer>
    </form>
  `,
})
export class PractitionerForm {
  readonly initial = input<Practitioner | null>(null);
  readonly submitted = output<Omit<Practitioner, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly practitionerTypes = PRACTITIONER_TYPES;

  // État dérivé modifiable : se réinitialise quand `initial` change, éditable par le form.
  protected readonly model = linkedSignal<PractitionerFormModel>(() => {
    const data = this.initial();
    return data
      ? {
          name: data.name,
          type: data.type,
          phone: data.phone ?? '',
          email: data.email ?? '',
          address: data.address ?? '',
          bookingUrl: data.bookingUrl ?? '',
        }
      : { ...EMPTY_MODEL };
  });

  protected readonly practitionerForm = form(this.model, (path) => {
    required(path.name, { message: 'medical.practitioner.form.nameRequired' });
    required(path.type, { message: 'medical.practitioner.form.typeRequired' });
    email(path.email, { message: 'medical.practitioner.form.emailInvalid' });
  });

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.practitionerForm, async () => {
      const v = this.model();
      this.submitted.emit({
        name: v.name,
        type: v.type,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        bookingUrl: v.bookingUrl || null,
      });
      return [];
    });
  }
}
