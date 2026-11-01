import { ChangeDetectionStrategy, Component, input, model, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-payslip-dropzone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, Icon, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div role="group" aria-labelledby="recurring-payslip-label">
      <span id="recurring-payslip-label" class="block text-sm font-medium text-text-muted mb-1">{{
        'budget.recurringForm.payslip' | transloco
      }}</span>

      @if (hasExisting() && !pendingFile()) {
        <div
          class="flex items-center justify-between rounded-lg border border-ib-green/30 bg-ib-green/5 px-3 py-2"
        >
          <div class="flex items-center gap-2 text-sm text-ib-green">
            <app-icon name="file-text" size="16" />
            <span>{{ 'budget.recurringForm.payslipAttached' | transloco }}</span>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded border border-border min-h-8 px-3 py-1.5 text-xs text-text-muted hover:text-ib-cyan hover:border-ib-cyan/30 transition-colors"
              (click)="view.emit()"
            >
              {{ 'budget.recurringForm.payslipView' | transloco }}
            </button>
            <button
              type="button"
              class="rounded border border-border min-h-8 px-3 py-1.5 text-xs text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
              (click)="remove.emit()"
            >
              {{ 'budget.recurringForm.payslipRemove' | transloco }}
            </button>
          </div>
        </div>
      } @else {
        <div
          class="relative rounded-lg border-2 border-dashed transition-colors"
          [class.border-ib-cyan]="isDragging()"
          [class.bg-ib-cyan-5]="isDragging()"
          [class.border-border]="!isDragging()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave()"
          (drop)="onDrop($event)"
        >
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            (change)="onFileInput($event)"
          />
          <div class="flex flex-col items-center py-6 pointer-events-none">
            @if (pendingFile()) {
              <app-icon name="file-text" size="24" class="text-ib-green mb-1" />
              <p class="text-sm font-medium text-ib-green">{{ pendingFile()!.name }}</p>
              <p class="text-xs text-text-muted mt-0.5">
                {{
                  'budget.recurringForm.fileSizeKb'
                    | transloco: { size: (pendingFile()!.size / 1024 | number: '1.0-0') }
                }}
              </p>
            } @else {
              <app-icon name="file-text" size="24" class="text-text-muted mb-1" />
              <p class="text-sm text-text-muted">
                {{ 'budget.recurringForm.payslipDropHint' | transloco }}
              </p>
              <p class="text-xs text-text-muted mt-0.5">
                {{ 'budget.recurringForm.payslipBrowseHint' | transloco }}
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class PayslipDropzone {
  readonly hasExisting = input<boolean>(false);
  readonly pendingFile = model<File | null>(null);
  readonly view = output<void>();
  readonly remove = output<void>();

  protected readonly isDragging = signal(false);

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  protected onDragLeave() {
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files[0];
    if (file) {
      this.pendingFile.set(file);
    }
  }

  protected onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.pendingFile.set(file);
    }
  }
}
