import { Component, ChangeDetectionStrategy, input, output, signal, viewChild } from '@angular/core';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';

@Component({
  selector: 'app-recovery-key-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog],
  host: { class: 'contents' },
  template: `
    <app-modal-dialog #modal title="Clé de récupération" size="md" (closed)="closed.emit()">
      <div class="flex flex-col gap-4">
        <div class="rounded-lg bg-ib-amber/10 border border-ib-amber/20 p-4">
          <p class="text-sm font-medium text-ib-amber">Important</p>
          <p class="mt-1 text-sm text-text-primary">
            Cette clé est votre seul moyen de récupérer vos données si vous oubliez votre mot de passe.
            Sauvegardez-la en lieu sûr. Elle ne sera plus affichée.
          </p>
        </div>

        <div class="rounded-lg border border-border bg-canvas p-4">
          <p class="mb-2 text-xs font-medium text-text-muted uppercase tracking-wide">Clé de récupération</p>
          <p class="font-mono text-sm break-all leading-relaxed text-text-primary select-all">
            {{ formattedKey() }}
          </p>
        </div>

        <button
          type="button"
          (click)="copyKey()"
          class="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-hover transition-colors"
        >
          {{ copied() ? 'Copié !' : 'Copier la clé' }}
        </button>

        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            [checked]="confirmed()"
            (change)="confirmed.set(!confirmed())"
            class="mt-0.5 h-4 w-4 rounded border-border text-ib-blue focus:ring-ib-blue"
          />
          <span class="text-sm text-text-primary">
            J'ai sauvegardé cette clé en lieu sûr
          </span>
        </label>

        <button
          type="button"
          [disabled]="!confirmed()"
          (click)="continue()"
          class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuer
        </button>
      </div>
    </app-modal-dialog>
  `,
})
export class RecoveryKeyModal {
  readonly recoveryKey = input.required<string>();
  readonly closed = output<void>();
  readonly confirmed$ = output<void>();

  private readonly modal = viewChild.required(ModalDialog);

  protected readonly confirmed = signal(false);
  protected readonly copied = signal(false);

  protected formattedKey(): string {
    const key = this.recoveryKey();
    return key.match(/.{4}/g)?.join(' ') ?? key;
  }

  protected async copyKey(): Promise<void> {
    await navigator.clipboard.writeText(this.recoveryKey());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  protected continue(): void {
    this.confirmed$.emit();
    this.modal().close();
  }

  open(): void {
    this.confirmed.set(false);
    this.copied.set(false);
    this.modal().open();
  }
}
