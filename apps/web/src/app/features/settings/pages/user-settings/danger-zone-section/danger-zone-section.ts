import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/domain/auth.store';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';

@Component({
  selector: 'app-danger-zone-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <!-- ── Danger zone ── -->
    <section
      aria-labelledby="danger-heading"
      class="rounded-2xl border border-ib-red/20 bg-ib-red/2 shadow-sm overflow-hidden"
    >
      <div class="px-6 py-5 border-b border-ib-red/10 bg-ib-red/3">
        <h3 id="danger-heading" class="text-base font-semibold text-ib-red flex items-center gap-2">
          {{ 'settings.danger.title' | transloco }}
        </h3>
      </div>
      <div class="p-6">
        <p class="text-sm text-text-primary font-medium mb-1">
          {{ 'settings.danger.deleteHeading' | transloco }}
        </p>
        <p class="text-sm text-text-muted mb-5">
          {{ 'settings.danger.deleteWarning' | transloco }}
        </p>

        <div class="flex flex-col sm:flex-row gap-3">
          <input
            id="delete-confirm"
            type="text"
            #deleteInput
            (input)="deleteConfirmValue.set(deleteInput.value)"
            class="flex-1 rounded-lg border border-ib-red/30 bg-surface px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-ib-red focus:outline-none focus:ring-1 focus:ring-ib-red placeholder:text-text-muted"
            [attr.placeholder]="auth.email()"
          />

          <button
            type="button"
            (click)="deleteAccount()"
            [disabled]="deleteConfirmValue() !== auth.email() || deleting()"
            class="inline-flex shrink-0 items-center justify-center rounded-lg bg-ib-red px-6 py-2.5 text-sm font-medium text-canvas hover:bg-ib-red/90 transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red focus-visible:ring-offset-2"
          >
            {{ (deleting() ? 'settings.danger.deleting' : 'settings.danger.delete') | transloco }}
          </button>
        </div>
      </div>
    </section>
  `,
})
export class DangerZoneSection {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);
  private readonly toaster = inject(Toaster);

  protected readonly deleteConfirmValue = signal('');
  protected readonly deleting = signal(false);

  protected async deleteAccount() {
    if (this.deleteConfirmValue() !== this.auth.email()) return;

    const confirmed = await this.confirm.confirm({
      title: this._i18n.translate('settings.danger.confirmTitle'),
      message: this._i18n.translate('settings.danger.confirmMessage'),
      confirmLabel: this._i18n.translate('settings.danger.confirmDelete'),
      cancelLabel: this._i18n.translate('common.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this.deleting.set(true);
    try {
      await this.auth.deleteAccount();
      this.router.navigate(['/auth/login']);
    } catch {
      this.showFeedback('error', this._i18n.translate('settings.danger.feedback.deleteFailed'));
      this.deleting.set(false);
    }
  }

  private showFeedback(type: 'success' | 'error', message: string) {
    this.toaster[type](message);
  }
}
