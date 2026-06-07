import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { Member } from '../../domain/models/member.model';
import { MEMBER_PALETTE } from '../../domain/member-map';

@Component({
  selector: 'app-member-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, TranslocoPipe, ModalDialog],
  host: { class: 'contents' },
  template: `
    <app-modal-dialog #modal [title]="'budget.members.title' | transloco" (closed)="resetForm()">
      @if (members().length > 0) {
        <ul class="mb-4 divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
          @for (m of members(); track m.id; let i = $index) {
            <li class="flex items-center justify-between gap-3 px-3 py-2">
              <span class="flex min-w-0 items-center gap-2">
                <span
                  class="inline-block h-3 w-3 shrink-0 rounded-full"
                  [style.background-color]="color(i)"
                ></span>
                <span class="truncate text-sm text-text-primary"
                  >{{ m.firstName }} {{ m.lastName }}</span
                >
              </span>
              <span class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  class="rounded-md p-1.5 text-text-muted hover:bg-hover hover:text-text-primary transition-colors"
                  [attr.aria-label]="'budget.members.editAria' | transloco: { name: m.firstName }"
                  (click)="startEdit(m)"
                >
                  <app-icon name="pencil" size="14" />
                </button>
                <button
                  type="button"
                  class="rounded-md p-1.5 text-text-muted hover:bg-hover hover:text-ib-red transition-colors"
                  [attr.aria-label]="'budget.members.deleteAria' | transloco: { name: m.firstName }"
                  (click)="remove(m)"
                >
                  <app-icon name="trash" size="14" />
                </button>
              </span>
            </li>
          }
        </ul>
      } @else {
        <p class="mb-4 text-sm text-text-muted">{{ 'budget.members.empty' | transloco }}</p>
      }

      <form (ngSubmit)="save()" class="space-y-3 border-t border-border pt-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {{ (editingId() ? 'budget.members.editTitle' : 'budget.members.addTitle') | transloco }}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="member-first" class="block text-sm font-medium text-text-muted mb-1"
              >{{ 'budget.members.firstName' | transloco }} <span aria-hidden="true">*</span></label
            >
            <input
              id="member-first"
              type="text"
              [ngModel]="firstName()"
              (ngModelChange)="firstName.set($event)"
              name="firstName"
              maxlength="255"
              class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label for="member-last" class="block text-sm font-medium text-text-muted mb-1">{{
              'budget.members.lastName' | transloco
            }}</label>
            <input
              id="member-last"
              type="text"
              [ngModel]="lastName()"
              (ngModelChange)="lastName.set($event)"
              name="lastName"
              maxlength="255"
              class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2">
          @if (editingId()) {
            <button
              type="button"
              class="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
              (click)="resetForm()"
            >
              {{ 'common.cancel' | transloco }}
            </button>
          }
          <button
            type="submit"
            [disabled]="!firstName().trim()"
            class="rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors disabled:opacity-50"
          >
            {{ (editingId() ? 'common.save' : 'budget.members.add') | transloco }}
          </button>
        </div>
      </form>
    </app-modal-dialog>
  `,
})
export class MemberManager {
  private readonly gateway = inject(MemberGateway);
  private readonly confirm = inject(ConfirmService);
  private readonly toaster = inject(Toaster);
  private readonly _i18n = inject(TranslocoService);

  readonly changed = output<void>();

  private readonly modalRef = viewChild.required<ModalDialog>('modal');
  private readonly _refresh = signal(0);

  protected readonly members = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.gateway.getAll())),
    { initialValue: [] as Member[] },
  );

  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly editingId = signal<string | null>(null);
  private _editingMember: Member | null = null;

  open(): void {
    this.modalRef().open();
  }

  protected color(index: number): string {
    return MEMBER_PALETTE[index % MEMBER_PALETTE.length];
  }

  protected startEdit(member: Member): void {
    this._editingMember = member;
    this.editingId.set(member.id);
    this.firstName.set(member.firstName);
    this.lastName.set(member.lastName);
  }

  protected resetForm(): void {
    this.editingId.set(null);
    this._editingMember = null;
    this.firstName.set('');
    this.lastName.set('');
  }

  protected async save(): Promise<void> {
    const firstName = this.firstName().trim();
    if (!firstName) return;
    const lastName = this.lastName().trim();
    try {
      if (this._editingMember) {
        // Membre complet (porte d'éventuels champs médicaux au runtime) + champs édités.
        await lastValueFrom(
          this.gateway.update(this._editingMember.id, {
            ...this._editingMember,
            firstName,
            lastName,
          }),
        );
        this.toaster.success('budget.members.updated');
      } else {
        await lastValueFrom(this.gateway.create({ firstName, lastName, color: null }));
        this.toaster.success('budget.members.created');
      }
      this.resetForm();
      this._refresh.update((v) => v + 1);
      this.changed.emit();
    } catch {
      this.toaster.error('budget.members.error');
    }
  }

  protected async remove(member: Member): Promise<void> {
    if (
      !(await this.confirm.confirm({
        title: this._i18n.translate('budget.members.deleteConfirmTitle'),
        message: this._i18n.translate('budget.members.deleteConfirmMessage', {
          name: `${member.firstName} ${member.lastName}`,
        }),
        confirmLabel: this._i18n.translate('budget.actions.delete'),
        variant: 'danger',
      }))
    )
      return;
    try {
      await lastValueFrom(this.gateway.delete(member.id));
      this.toaster.success('budget.members.deleted');
      if (this.editingId() === member.id) this.resetForm();
      this._refresh.update((v) => v + 1);
      this.changed.emit();
    } catch {
      this.toaster.error('budget.members.error');
    }
  }
}
