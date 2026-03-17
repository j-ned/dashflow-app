import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { Icon } from '@shared/components/icon/icon';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-modal-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'contents' },
  template: `
    <dialog #dialog
            class="modal-dialog"
            (click)="onBackdropClick($event)"
            (close)="onDialogClose()">
      @if (isOpen()) {
        <div class="modal-content" [class]="sizeClass()" (click)="$event.stopPropagation()">
          <header class="flex items-center justify-between pb-3 mb-3 border-b border-border shrink-0">
            <h3 class="text-base font-semibold text-text-primary">{{ title() }}</h3>
            <button type="button"
                    class="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                    aria-label="Fermer"
                    (click)="close()">
              <app-icon name="x" size="18" />
            </button>
          </header>
          <div class="overflow-y-auto flex-1 min-h-0">
            <ng-content />
          </div>
        </div>
      }
    </dialog>
  `,
})
export class ModalDialog {
  readonly title = input.required<string>();
  readonly size = input<ModalSize>('md');
  readonly closed = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Exposed for call-site conditional rendering: @if (modal.isOpen()) { <content /> } */
  readonly isOpen = signal(false);
  protected readonly sizeClass = computed(() => `modal-content modal-${this.size()}`);

  open() {
    this.isOpen.set(true);
    this.dialogRef().nativeElement.showModal();
  }

  close() {
    this.dialogRef().nativeElement.close();
  }

  protected onDialogClose() {
    this.isOpen.set(false);
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent) {
    if (event.target === this.dialogRef().nativeElement) {
      this.close();
    }
  }
}
