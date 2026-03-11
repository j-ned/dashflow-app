import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { Icon, type IconName } from '@shared/components/icon/icon';

// ── Types ──

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  readonly id: number;
  readonly message: string;
  readonly type: ToastType;
  readonly duration: number;
  readonly leaving: boolean;
};

type ToastConfig = {
  duration?: number;
};

const TOAST_ICONS: Record<ToastType, IconName> = {
  success: 'check',
  error: 'alert-triangle',
  info: 'eye',
};

const TOAST_STYLES: Record<ToastType, { accent: string; bg: string; icon: string; bar: string }> = {
  success: {
    accent: 'border-l-ib-green',
    bg: 'bg-ib-green/5',
    icon: 'text-ib-green',
    bar: 'bg-ib-green',
  },
  error: {
    accent: 'border-l-ib-red',
    bg: 'bg-ib-red/5',
    icon: 'text-ib-red',
    bar: 'bg-ib-red',
  },
  info: {
    accent: 'border-l-ib-blue',
    bg: 'bg-ib-blue/5',
    icon: 'text-ib-blue',
    bar: 'bg-ib-blue',
  },
};

const DEFAULT_DURATION = 4000;
const LEAVE_ANIMATION_MS = 300;

// ── Service ──

@Injectable({ providedIn: 'root' })
export class Toaster {
  private _nextId = 0;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string, config?: ToastConfig) {
    this._add(message, 'success', config);
  }

  error(message: string, config?: ToastConfig) {
    this._add(message, 'error', config);
  }

  info(message: string, config?: ToastConfig) {
    this._add(message, 'info', config);
  }

  dismiss(id: number) {
    this._toasts.update(list =>
      list.map(t => (t.id === id ? { ...t, leaving: true } : t)),
    );
    setTimeout(() => {
      this._toasts.update(list => list.filter(t => t.id !== id));
    }, LEAVE_ANIMATION_MS);
  }

  private _add(message: string, type: ToastType, config?: ToastConfig) {
    const id = this._nextId++;
    const duration = config?.duration ?? DEFAULT_DURATION;

    this._toasts.update(list => [...list, { id, message, type, duration, leaving: false }]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }
}

// ── Component ──

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'contents' },
  template: `
    <div class="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
         aria-live="polite"
         aria-relevant="additions">
      @for (toast of toasts(); track toast.id) {
        <div class="toast-card pointer-events-auto border-l-[3px]"
             [class]="style(toast.type).accent + ' ' + style(toast.type).bg"
             [class.toast-enter]="!toast.leaving"
             [class.toast-leave]="toast.leaving"
             role="status">
          <div class="flex items-start gap-2.5 px-3.5 pt-3 pb-2.5">
            <app-icon [name]="icon(toast.type)" size="16"
                      class="shrink-0 mt-0.5"
                      [class]="style(toast.type).icon" />
            <p class="flex-1 text-sm text-text-primary leading-snug">{{ toast.message }}</p>
            <button type="button"
                    class="shrink-0 rounded p-0.5 text-text-muted hover:text-text-primary transition-colors"
                    aria-label="Fermer"
                    (click)="dismiss(toast.id)">
              <app-icon name="x" size="14" />
            </button>
          </div>
          @if (toast.duration > 0) {
            <div class="h-[2px] w-full overflow-hidden rounded-b">
              <div class="h-full rounded-full toast-progress"
                   [class]="style(toast.type).bar"
                   [style.animation-duration.ms]="toast.duration">
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .toast-card {
      width: 360px;
      max-width: calc(100vw - 2rem);
      background-color: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }

    .toast-enter {
      animation: toast-slide-in 250ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .toast-leave {
      animation: toast-slide-out 300ms cubic-bezier(0.4, 0, 1, 1) forwards;
    }

    @keyframes toast-slide-in {
      from {
        opacity: 0;
        transform: translateX(100%) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    @keyframes toast-slide-out {
      from {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateX(100%) scale(0.95);
      }
    }

    .toast-progress {
      animation: toast-shrink linear forwards;
    }

    @keyframes toast-shrink {
      from {
        width: 100%;
      }
      to {
        width: 0;
      }
    }
  `,
})
export class ToastContainer {
  private readonly toaster = inject(Toaster);
  protected readonly toasts = this.toaster.toasts;

  protected icon(type: ToastType): IconName {
    return TOAST_ICONS[type];
  }

  protected style(type: ToastType) {
    return TOAST_STYLES[type];
  }

  protected dismiss(id: number) {
    this.toaster.dismiss(id);
  }
}
