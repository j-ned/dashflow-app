import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-modal-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'contents' },
  template: `
    <dialog #dialog
            class="modal-dialog"
            (click)="onBackdropClick($event)"
            (close)="closed.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <header class="flex items-center justify-between pb-3 mb-3 border-b border-border">
          <h3 class="text-base font-semibold text-text-primary">{{ title() }}</h3>
          <button type="button"
                  class="rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                  aria-label="Fermer"
                  (click)="close()">
            <app-icon name="x" size="18" />
          </button>
        </header>
        <div>
          <ng-content />
        </div>
      </div>
    </dialog>
  `,
})
export class ModalDialog {
  readonly title = input.required<string>();
  readonly closed = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open() {
    this.dialogRef().nativeElement.showModal();
  }

  close() {
    this.dialogRef().nativeElement.close();
  }

  protected onBackdropClick(event: MouseEvent) {
    if (event.target === this.dialogRef().nativeElement) {
      this.close();
    }
  }
}
