import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '@shared/components/icon/icon';

// ── Types ──

type ConfirmVariant = 'danger' | 'warning' | 'info';

type ConfirmOptions = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: ConfirmVariant;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

const VARIANT_STYLES: Record<ConfirmVariant, { icon: string; iconBg: string; btn: string }> = {
  danger: {
    icon: 'text-ib-red',
    iconBg: 'bg-ib-red/10',
    btn: 'bg-ib-red hover:bg-ib-red/90 focus-visible:ring-ib-red',
  },
  warning: {
    icon: 'text-ib-yellow',
    iconBg: 'bg-ib-yellow/10',
    btn: 'bg-ib-yellow hover:bg-ib-yellow/90 focus-visible:ring-ib-yellow',
  },
  info: {
    icon: 'text-ib-blue',
    iconBg: 'bg-ib-blue/10',
    btn: 'bg-ib-blue hover:bg-ib-blue/90 focus-visible:ring-ib-blue',
  },
};

// ── Service ──

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly _pending = signal<PendingConfirm | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      this._pending.set({ ...options, resolve });
    });
  }

  /** Shorthand for delete confirmations */
  delete(entityName: string): Promise<boolean> {
    return this.confirm({
      title: 'Confirmer la suppression',
      message: `Supprimer ${entityName} ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
  }
}

// ── Component ──

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'contents' },
  template: `
    <dialog #dialog
            class="confirm-dialog"
            (click)="onBackdropClick($event)"
            (close)="onDialogClose()">
      @if (pending(); as p) {
        <div class="confirm-panel" (click)="$event.stopPropagation()">
          <div class="flex gap-4 p-5">
            <div class="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
                 [class]="style().iconBg">
              <app-icon name="alert-triangle" size="20"
                        [class]="style().icon" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-semibold text-text-primary">{{ p.title }}</h3>
              <p class="mt-1 text-sm text-text-muted leading-relaxed">{{ p.message }}</p>
            </div>
          </div>

          <div class="flex justify-end gap-2 px-5 pb-4">
            <button type="button"
                    class="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                    (click)="answer(false)">
              {{ p.cancelLabel || 'Annuler' }}
            </button>
            <button type="button"
                    class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2"
                    [class]="style().btn"
                    (click)="answer(true)">
              {{ p.confirmLabel || 'Confirmer' }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: `
    dialog.confirm-dialog {
      background: transparent;
      border: none;
      padding: 0;
      max-width: 100vw;
      max-height: 100vh;
      overflow: visible;
      margin: auto;
    }

    dialog.confirm-dialog::backdrop {
      background: rgba(0, 0, 0, 0.6);
    }

    dialog.confirm-dialog[open] {
      animation: cd-fade-in 150ms ease-out;
    }

    dialog.confirm-dialog[open]::backdrop {
      animation: cd-backdrop-in 150ms ease-out;
    }

    @keyframes cd-fade-in {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1); }
    }

    @keyframes cd-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .confirm-panel {
      width: min(420px, 90vw);
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.45);
      overflow: hidden;
    }
  `,
})
export class ConfirmDialog {
  private readonly service = inject(ConfirmService);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly pending = this.service._pending;

  constructor() {
    effect(() => {
      const p = this.pending();
      const dialog = this.dialogRef().nativeElement;
      if (p && !dialog.open) {
        dialog.showModal();
      } else if (!p && dialog.open) {
        dialog.close();
      }
    });
  }

  protected readonly style = computed(() => VARIANT_STYLES[this.pending()?.variant ?? 'danger']);

  protected answer(confirmed: boolean) {
    const p = this.pending();
    if (p) {
      p.resolve(confirmed);
      this.service._pending.set(null);
    }
  }

  protected onBackdropClick(e: MouseEvent) {
    if (e.target === this.dialogRef().nativeElement) {
      this.answer(false);
    }
  }

  protected onDialogClose() {
    // Escape key pressed — resolve as false
    const p = this.pending();
    if (p) {
      p.resolve(false);
      this.service._pending.set(null);
    }
  }
}
