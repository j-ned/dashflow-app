import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { Member } from '../../domain/models/member.model';
import { MemberManager } from './member-manager';

const LEA: Member = { id: 'm1', firstName: 'Léa', lastName: 'Martin', color: null };

const MEDICAL_409 = {
  status: 409,
  message: 'Ce membre a un dossier médical',
  code: 'MEMBER_HAS_MEDICAL_DATA',
  details: { appointments: 2, prescriptions: 0, medications: 1, documents: 0 },
};

type Cmp = { remove(member: Member): Promise<void> };

function make(opts: {
  deleteImpl: (id: string, options?: { force?: boolean }) => ReturnType<MemberGateway['delete']>;
  answers: boolean[];
}) {
  const del = vi.fn(opts.deleteImpl);
  const answers = [...opts.answers];
  type ConfirmOpts = { title: string; message: string; confirmLabel?: string };
  const confirm = vi.fn((_opts: ConfirmOpts) => Promise.resolve(answers.shift() ?? false));
  const success = vi.fn();
  const error = vi.fn();
  const translate = vi.fn((key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
  );

  TestBed.configureTestingModule({
    providers: [
      { provide: MemberGateway, useValue: { getAll: vi.fn(() => of([LEA])), delete: del } },
      { provide: ConfirmService, useValue: { confirm } },
      { provide: Toaster, useValue: { success, error } },
      { provide: TranslocoService, useValue: { translate } },
    ],
  });
  TestBed.overrideComponent(MemberManager, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(MemberManager);
  fixture.detectChanges();
  return {
    cmp: fixture.componentInstance as unknown as Cmp,
    del,
    confirm,
    success,
    error,
    translate,
  };
}

describe('MemberManager.remove', () => {
  it('sans dossier médical : une confirmation, un DELETE sans force, toast succès', async () => {
    const { cmp, del, confirm, success } = make({
      deleteImpl: () => of(undefined),
      answers: [true],
    });
    await cmp.remove(LEA);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith('m1');
    expect(success).toHaveBeenCalledWith('budget.members.deleted');
  });

  it('409 MEMBER_HAS_MEDICAL_DATA : seconde confirmation énumérant les compteurs, puis DELETE force', async () => {
    const { cmp, del, confirm, success, error, translate } = make({
      deleteImpl: (_id, options) =>
        options?.force ? of(undefined) : throwError(() => MEDICAL_409),
      answers: [true, true],
    });
    await cmp.remove(LEA);

    expect(confirm).toHaveBeenCalledTimes(2);
    // Le résumé n'énumère que les compteurs non nuls, dans l'ordre RDV → ordonnances → médicaments → documents.
    expect(translate).toHaveBeenCalledWith('budget.members.footprint.appointments', { count: 2 });
    expect(translate).toHaveBeenCalledWith('budget.members.footprint.medications', { count: 1 });
    expect(translate).not.toHaveBeenCalledWith(
      'budget.members.footprint.prescriptions',
      expect.anything(),
    );
    const second = confirm.mock.calls[1][0];
    expect(second.message).toContain('budget.members.medicalDeleteMessage');
    expect(second.message).toContain('Léa Martin');
    expect(second.confirmLabel).toBe('budget.members.medicalDeleteConfirm');

    expect(del).toHaveBeenNthCalledWith(1, 'm1');
    expect(del).toHaveBeenNthCalledWith(2, 'm1', { force: true });
    expect(success).toHaveBeenCalledWith('budget.members.deleted');
    expect(error).not.toHaveBeenCalled();
  });

  it('409 puis refus à la seconde confirmation : rien de forcé, pas de toast', async () => {
    const { cmp, del, success, error } = make({
      deleteImpl: () => throwError(() => MEDICAL_409),
      answers: [true, false],
    });
    await cmp.remove(LEA);
    expect(del).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('autre erreur (500) : toast erreur, aucune seconde confirmation', async () => {
    const { cmp, confirm, error } = make({
      deleteImpl: () => throwError(() => ({ status: 500, message: 'boom' })),
      answers: [true, true],
    });
    await cmp.remove(LEA);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('budget.members.error');
  });
});
