import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@features/auth/domain/auth.store';
import { ApiClient } from '@core/services/api/api-client';

@Component({
  selector: 'app-demo-banner',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div role="status" class="demo-banner">
        <span class="demo-banner__label">{{ 'demo.banner.label' | transloco }}</span>
        <span class="demo-banner__sep" aria-hidden="true">·</span>
        <span class="demo-banner__hint">{{ 'demo.banner.resetEvery' | transloco }}</span>
        <button type="button" class="demo-banner__action" [disabled]="resetting()" (click)="onReset()">
          {{ 'demo.banner.resetNow' | transloco }}
        </button>
      </div>
    }
  `,
  styles: `
    .demo-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      background-color: rgb(245 158 11 / 0.1);
      color: rgb(180 83 9);
      font-size: 0.875rem;
      border-bottom: 1px solid rgb(245 158 11 / 0.25);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .demo-banner__sep { opacity: 0.5; }
    .demo-banner__action {
      margin-left: auto;
      min-height: 44px;
      padding: 0 0.875rem;
      border-radius: 0.375rem;
      background-color: rgb(245 158 11 / 0.2);
      color: rgb(120 53 15);
      font-weight: 500;
      cursor: pointer;
      border: none;
    }
    .demo-banner__action:hover:not(:disabled) { background-color: rgb(245 158 11 / 0.3); }
    .demo-banner__action:focus-visible { outline: 2px solid rgb(245 158 11); outline-offset: 2px; }
    .demo-banner__action:disabled { opacity: 0.5; cursor: wait; }
  `,
})
export class DemoBanner {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(ApiClient);

  protected readonly visible = computed(() => !!this.auth.user()?.isDemoAccount);
  protected readonly resetting = signal(false);

  protected async onReset(): Promise<void> {
    if (this.resetting()) return;
    this.resetting.set(true);
    try {
      await firstValueFrom(this.api.post('/auth/demo-reset', {}));
      window.location.reload();
    } catch (err) {
      console.error('Demo reset failed', err);
      this.resetting.set(false);
    }
  }
}
