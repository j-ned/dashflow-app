import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';

type ProfileFormShape = {
  displayName: FormControl<string>;
};

@Component({
  selector: 'app-profile-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <!-- ── Profile ── -->
    <section
      aria-labelledby="profile-heading"
      class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden mb-8"
    >
      <div class="px-6 py-5 border-b border-border bg-surface/50">
        <h3 id="profile-heading" class="text-base font-semibold text-text-primary">
          {{ 'settings.profile.title' | transloco }}
        </h3>
        <p class="text-sm text-text-muted mt-1">{{ 'settings.profile.subtitle' | transloco }}</p>
      </div>
      <div class="p-6">
        <div class="flex flex-col sm:flex-row items-start gap-8">
          <div class="shrink-0 flex flex-col items-center gap-3">
            <button
              type="button"
              (click)="avatarInput.click()"
              class="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue transition-transform hover:scale-105"
            >
              @if (avatarPreview() || auth.avatarUrl()) {
                <!-- eslint-disable @angular-eslint/template/prefer-ngsrc -- avatar dynamique : la preview est une data: URL, non supportée par NgOptimizedImage -->
                <img
                  [src]="avatarPreview() || auth.avatarUrl()"
                  [alt]="'settings.profile.avatarAlt' | transloco"
                  class="w-24 h-24 rounded-full object-cover border-4 border-surface shadow-sm"
                />
                <!-- eslint-enable @angular-eslint/template/prefer-ngsrc -->
              } @else {
                <div
                  class="w-24 h-24 rounded-full bg-linear-to-br from-ib-purple to-ib-blue flex items-center justify-center text-3xl font-bold text-canvas shadow-sm border-4 border-surface"
                >
                  {{ auth.userInitial() }}
                </div>
              }
              <div
                class="absolute inset-0 rounded-full bg-canvas/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <app-icon name="camera" size="28" class="text-text-primary" />
              </div>
            </button>
            <input
              #avatarInput
              type="file"
              accept="image/*"
              class="hidden"
              (change)="onAvatarSelected($event)"
            />
          </div>

          <form
            [formGroup]="profileForm"
            (ngSubmit)="saveProfile()"
            class="flex-1 w-full space-y-5"
          >
            <fieldset class="space-y-5">
              <legend class="sr-only">{{ 'settings.profile.legend' | transloco }}</legend>
              <div class="space-y-1.5">
                <label for="display-name" class="text-sm font-medium text-text-primary">{{
                  'settings.profile.displayName' | transloco
                }}</label>
                <input
                  id="display-name"
                  type="text"
                  formControlName="displayName"
                  class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
                />
              </div>
              <div class="space-y-1.5">
                <label for="user-email" class="text-sm font-medium text-text-primary">{{
                  'settings.profile.email' | transloco
                }}</label>
                <input
                  id="user-email"
                  type="email"
                  [value]="auth.email()"
                  readonly
                  disabled
                  class="w-full rounded-lg border border-border/50 bg-raised px-4 py-2.5 text-sm text-text-muted cursor-not-allowed opacity-80"
                />
              </div>
            </fieldset>
            <div class="pt-2 flex justify-end">
              <button
                type="submit"
                [disabled]="profileForm.pristine || profileSaving()"
                class="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
              >
                {{
                  (profileSaving() ? 'settings.profile.saving' : 'settings.profile.save')
                    | transloco
                }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `,
})
export class ProfileSection {
  protected readonly auth = inject(AuthStore);
  private readonly _i18n = inject(TranslocoService);
  private readonly toaster = inject(Toaster);

  protected readonly avatarPreview = signal<string | null>(null);
  protected readonly profileSaving = signal(false);
  protected readonly profileForm = new FormGroup<ProfileFormShape>({
    displayName: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const name = this.auth.displayName();
      if (name && this.profileForm.pristine) {
        this.profileForm.patchValue({ displayName: name });
      }
    });
  }

  protected async onAvatarSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(reader.result as string);
    reader.readAsDataURL(file);

    this.profileSaving.set(true);
    try {
      await this.auth.uploadAvatar(file);
      this.showFeedback('success', this._i18n.translate('settings.profile.feedback.avatarUpdated'));
    } catch {
      this.avatarPreview.set(null);
      this.showFeedback('error', this._i18n.translate('settings.profile.feedback.avatarFailed'));
    } finally {
      this.profileSaving.set(false);
    }
  }

  protected async saveProfile() {
    if (this.profileForm.invalid) return;
    this.profileSaving.set(true);
    try {
      await this.auth.updateProfile({ displayName: this.profileForm.getRawValue().displayName });
      this.showFeedback('success', this._i18n.translate('settings.profile.feedback.updated'));
      this.profileForm.markAsPristine();
    } catch {
      this.showFeedback('error', this._i18n.translate('settings.profile.feedback.updateFailed'));
    } finally {
      this.profileSaving.set(false);
    }
  }

  private showFeedback(type: 'success' | 'error', message: string) {
    this.toaster[type](message);
  }
}
