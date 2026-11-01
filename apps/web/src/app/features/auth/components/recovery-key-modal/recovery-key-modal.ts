import {
  Component,
  ChangeDetectionStrategy,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';

@Component({
  selector: 'app-recovery-key-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <app-modal-dialog
      #modal
      [title]="'auth.recoveryKey.title' | transloco"
      size="md"
      (closed)="closed.emit()"
    >
      <div class="flex flex-col gap-4">
        <div class="rounded-lg bg-ib-amber/10 border border-ib-amber/20 p-4">
          <p class="text-sm font-medium text-ib-amber">
            {{ 'auth.recoveryKey.importantTitle' | transloco }}
          </p>
          <p class="mt-1 text-sm text-text-primary">
            {{ 'auth.recoveryKey.importantBody' | transloco }}
          </p>
        </div>

        <div class="rounded-lg border border-border bg-canvas p-4">
          <p class="mb-2 text-xs font-medium text-text-muted uppercase tracking-wide">
            {{ 'auth.recoveryKey.label' | transloco }}
          </p>
          <p class="font-mono text-sm break-all leading-relaxed text-text-primary select-all">
            {{ formattedKey() }}
          </p>
        </div>

        <button
          type="button"
          (click)="copyKey()"
          class="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-hover transition-colors"
        >
          {{ (copied() ? 'auth.recoveryKey.copied' : 'auth.recoveryKey.copy') | transloco }}
        </button>

        @if (copyFailed()) {
          <p role="alert" class="text-sm text-ib-red">
            {{ 'auth.recoveryKey.copyFailed' | transloco }}
          </p>
        }

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            [checked]="confirmed()"
            (change)="confirmed.set(!confirmed())"
            class="mt-0.5 h-4 w-4 rounded border-border text-ib-blue focus:ring-ib-blue"
          />
          <span class="text-sm text-text-primary">
            {{ 'auth.recoveryKey.saved' | transloco }}
          </span>
        </label>

        <button
          type="button"
          [disabled]="!confirmed()"
          (click)="continue()"
          class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ 'auth.recoveryKey.continue' | transloco }}
        </button>
      </div>
    </app-modal-dialog>
  `,
})
export class RecoveryKeyModal {
  readonly recoveryKey = input.required<string>();
  readonly closed = output<void>();
  readonly keySaved = output<void>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly modal = viewChild.required(ModalDialog);
  private _copiedTimeout?: ReturnType<typeof setTimeout>;

  protected readonly confirmed = signal(false);
  protected readonly copied = signal(false);
  protected readonly copyFailed = signal(false);
  protected readonly formattedKey = computed(() => {
    const key = this.recoveryKey();
    return key.match(/.{4}/g)?.join(' ') ?? key;
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this._copiedTimeout));
  }

  protected async copyKey(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.recoveryKey());
      this.copyFailed.set(false);
      this.copied.set(true);
      clearTimeout(this._copiedTimeout);
      this._copiedTimeout = setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copyFailed.set(true);
    }
  }

  protected continue(): void {
    this.keySaved.emit();
    this.modal().close();
  }

  open(): void {
    this.confirmed.set(false);
    this.copied.set(false);
    this.copyFailed.set(false);
    this.modal().open();
  }
}
