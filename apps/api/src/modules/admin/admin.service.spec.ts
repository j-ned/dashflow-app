import { describe, it, expect, vi } from 'vitest';
import { AdminService } from './admin.service';
import type {
  AdminNoticeRow,
  AdminRepository,
  AdminUserRow,
} from './admin.repository';
import type { Mailer } from '../../mail/mailer';

function row(over: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: 'u1',
    email: 'a@b.com',
    role: 'user',
    isDemoAccount: false,
    createdAt: new Date('2026-01-01'),
    emailVerified: true,
    hasPassword: true,
    authVersion: 1,
    encryptionVersion: 1,
    hasRecoveryKey: true,
    totpEnabled: true,
    ...over,
  };
}

const repo = (
  rows: AdminUserRow[],
  opts: {
    total?: number;
    notices?: AdminNoticeRow[];
    verifiedMeanwhile?: string[];
    purged?: number;
  } = {},
) =>
  ({
    listUsers: vi.fn().mockResolvedValue(rows),
    countAll: vi.fn().mockResolvedValue(opts.total ?? rows.length),
    listForNotice: vi
      .fn()
      .mockImplementation((ids?: string[]) =>
        Promise.resolve(ids ? rows.filter((r) => ids.includes(r.id)) : rows),
      ),
    noticesSince: vi.fn().mockResolvedValue(opts.notices ?? []),
    recordNotice: vi.fn().mockResolvedValue(undefined),
    bumpSessionVersion: vi.fn().mockResolvedValue(undefined),
    findForDeletion: vi
      .fn()
      .mockImplementation((ids: string[]) =>
        Promise.resolve(rows.filter((r) => ids.includes(r.id))),
      ),
    deleteUnverified: vi
      .fn()
      .mockImplementation((ids: string[]) =>
        Promise.resolve(
          rows
            .filter(
              (r) =>
                ids.includes(r.id) && !opts.verifiedMeanwhile?.includes(r.id),
            )
            .map((r) => ({ id: r.id, email: r.email })),
        ),
      ),
    purgeUnverified: vi.fn().mockResolvedValue(opts.purged ?? 0),
  }) as unknown as AdminRepository & Record<string, ReturnType<typeof vi.fn>>;

const mailer = (send = vi.fn().mockResolvedValue(undefined)) =>
  ({ sendSecurityNotice: send }) as unknown as Mailer & {
    sendSecurityNotice: ReturnType<typeof vi.fn>;
  };

describe('AdminService.listUsers', () => {
  it('expose le statut de sécurité et aucune colonne sensible', async () => {
    const svc = new AdminService(repo([row()]), mailer());
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.items[0]).toEqual({
      id: 'u1',
      email: 'a@b.com',
      role: 'user',
      isDemoAccount: false,
      createdAt: new Date('2026-01-01'),
      security: { status: 'ok', issues: [] },
      lastNotice: null,
    });
  });

  it('signale un compte à reconnecter et sa dernière relance', async () => {
    const at = new Date('2026-09-18T10:00:00Z');
    const svc = new AdminService(
      repo([row({ authVersion: 0 })], {
        notices: [{ userId: 'u1', type: 'admin_notice_reconnect', at }],
      }),
      mailer(),
    );
    const [item] = (await svc.listUsers({ limit: 20, offset: 0 })).items;
    expect(item.security.status).toBe('action');
    expect(item.lastNotice).toEqual({ reason: 'reconnect', at });
  });

  it('normalise un rôle inconnu vers "user" et préserve admin', async () => {
    const svc = new AdminService(
      repo([row({ role: 'whatever' }), row({ id: 'u2', role: 'admin' })]),
      mailer(),
    );
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.items.map((i) => i.role)).toEqual(['user', 'admin']);
  });

  it('transmet search/limit/offset et renvoie le total du repository', async () => {
    const r = repo([row()], { total: 57 });
    const svc = new AdminService(r, mailer());
    const res = await svc.listUsers({ search: 'a@b', limit: 10, offset: 20 });
    expect(r.listUsers).toHaveBeenCalledWith({
      search: 'a@b',
      limit: 10,
      offset: 20,
    });
    expect(r.countAll).toHaveBeenCalledWith('a@b');
    expect(res.total).toBe(57);
  });
});

describe('AdminService.sendNotices', () => {
  it('envoi groupé : seuls les comptes concernés reçoivent le mail, sans bruit pour les autres', async () => {
    const r = repo([
      row({ id: 'old', email: 'old@x.fr', authVersion: 0 }),
      row({ id: 'ok', email: 'ok@x.fr' }),
    ]);
    const m = mailer();
    const res = await new AdminService(r, m).sendNotices(
      'reconnect',
      undefined,
      'admin1',
    );
    expect(m.sendSecurityNotice).toHaveBeenCalledTimes(1);
    expect(m.sendSecurityNotice).toHaveBeenCalledWith('old@x.fr', 'reconnect');
    expect(res.sent).toEqual([{ id: 'old', email: 'old@x.fr' }]);
    expect(res.skipped).toEqual([]);
  });

  it('reconnect : trace la relance puis ferme les sessions du compte', async () => {
    const r = repo([row({ id: 'old', authVersion: 0 })]);
    await new AdminService(r, mailer()).sendNotices('reconnect', ['old'], 'a');
    expect(r.recordNotice).toHaveBeenCalledWith(
      'old',
      'admin_notice_reconnect',
    );
    expect(r.bumpSessionVersion).toHaveBeenCalledWith('old');
  });

  it('les autres motifs ne déconnectent personne', async () => {
    const r = repo([row({ id: 'u', totpEnabled: false })]);
    await new AdminService(r, mailer()).sendNotices('enable_2fa', ['u'], 'a');
    expect(r.recordNotice).toHaveBeenCalledWith('u', 'admin_notice_enable_2fa');
    expect(r.bumpSessionVersion).not.toHaveBeenCalled();
  });

  it('envoi sélectif : explique pourquoi un compte coché a été ignoré', async () => {
    const r = repo([row({ id: 'ok', email: 'ok@x.fr' })]);
    const m = mailer();
    const res = await new AdminService(r, m).sendNotices(
      'reconnect',
      ['ok', '00000000-0000-4000-8000-000000000000'],
      'a',
    );
    expect(m.sendSecurityNotice).not.toHaveBeenCalled();
    expect(res.skipped).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000000',
        email: null,
        why: 'not_found',
      },
      { id: 'ok', email: 'ok@x.fr', why: 'not_eligible' },
    ]);
  });

  it('délai de 7 jours : pas de second mail pour le même motif', async () => {
    const r = repo([row({ id: 'old', email: 'old@x.fr', authVersion: 0 })], {
      notices: [
        { userId: 'old', type: 'admin_notice_reconnect', at: new Date() },
      ],
    });
    const m = mailer();
    const res = await new AdminService(r, m).sendNotices(
      'reconnect',
      undefined,
      'a',
    );
    expect(m.sendSecurityNotice).not.toHaveBeenCalled();
    expect(res.skipped).toEqual([
      { id: 'old', email: 'old@x.fr', why: 'cooldown' },
    ]);
  });

  it('un motif déjà relancé ne bloque pas un autre motif', async () => {
    const r = repo([row({ id: 'u', authVersion: 0, totpEnabled: false })], {
      notices: [
        { userId: 'u', type: 'admin_notice_enable_2fa', at: new Date() },
      ],
    });
    const res = await new AdminService(r, mailer()).sendNotices(
      'reconnect',
      ['u'],
      'a',
    );
    expect(res.sent).toHaveLength(1);
  });

  it("échec SMTP : ni trace ni déconnexion, et l'envoi continue pour les autres", async () => {
    const r = repo([
      row({ id: 'ko', email: 'ko@x.fr', authVersion: 0 }),
      row({ id: 'go', email: 'go@x.fr', authVersion: 0 }),
    ]);
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce(undefined);
    const res = await new AdminService(r, mailer(send)).sendNotices(
      'reconnect',
      undefined,
      'a',
    );
    expect(res.skipped).toEqual([
      { id: 'ko', email: 'ko@x.fr', why: 'send_failed' },
    ]);
    expect(res.sent).toEqual([{ id: 'go', email: 'go@x.fr' }]);
    expect(r.bumpSessionVersion).toHaveBeenCalledTimes(1);
    expect(r.bumpSessionVersion).toHaveBeenCalledWith('go');
  });
});

describe('AdminService.noticeSummary', () => {
  it('compte par motif les comptes concernés et ceux encore dans le délai', async () => {
    const r = repo(
      [
        row({ id: 'a', authVersion: 0 }),
        row({ id: 'b', authVersion: 0, totpEnabled: false }),
        row({ id: 'c' }),
      ],
      {
        notices: [
          { userId: 'a', type: 'admin_notice_reconnect', at: new Date() },
        ],
      },
    );
    const summary = await new AdminService(r, mailer()).noticeSummary();
    expect(summary.reconnect).toEqual({ eligible: 2, onCooldown: 1 });
    expect(summary.enable_2fa).toEqual({ eligible: 1, onCooldown: 0 });
    expect(summary.enable_encryption).toEqual({ eligible: 0, onCooldown: 0 });
  });
});

describe('AdminService.sendNotices — comptes non vérifiés', () => {
  it("n'écrit jamais à une adresse non vérifiée, même cochée, même en envoi groupé", async () => {
    const r = repo([
      row({
        id: 'fake',
        email: 'jean@gmail.com',
        emailVerified: false,
        encryptionVersion: 0,
      }),
    ]);
    const m = mailer();
    const svc = new AdminService(r, m);
    const grouped = await svc.sendNotices('enable_encryption', undefined, 'a');
    const selective = await svc.sendNotices('enable_encryption', ['fake'], 'a');
    expect(m.sendSecurityNotice).not.toHaveBeenCalled();
    expect(grouped.sent).toEqual([]);
    expect(selective.skipped).toEqual([
      { id: 'fake', email: 'jean@gmail.com', why: 'not_eligible' },
    ]);
  });
});

describe('AdminService.deleteUnverifiedUsers', () => {
  it('supprime les comptes jamais vérifiés et refuse tous les autres, avec la raison', async () => {
    const r = repo([
      row({ id: 'fake', email: 'test@gmail.com', emailVerified: false }),
      row({ id: 'real', email: 'maman@x.fr' }),
      row({
        id: 'boss',
        email: 'boss@x.fr',
        role: 'admin',
        emailVerified: false,
      }),
      row({
        id: 'demo',
        email: 'demo@x.fr',
        isDemoAccount: true,
        emailVerified: false,
      }),
      row({ id: 'me', email: 'me@x.fr', emailVerified: false }),
    ]);
    const res = await new AdminService(r, mailer()).deleteUnverifiedUsers(
      ['fake', 'real', 'boss', 'demo', 'me', 'ghost'],
      'me',
    );
    expect(r.deleteUnverified).toHaveBeenCalledWith(['fake']);
    expect(res.deleted).toEqual([{ id: 'fake', email: 'test@gmail.com' }]);
    expect(res.skipped).toEqual([
      { id: 'real', email: 'maman@x.fr', why: 'verified' },
      { id: 'boss', email: 'boss@x.fr', why: 'admin' },
      { id: 'demo', email: 'demo@x.fr', why: 'demo' },
      { id: 'me', email: 'me@x.fr', why: 'self' },
      { id: 'ghost', email: null, why: 'not_found' },
    ]);
  });

  it('compte validé entre la lecture et la suppression : épargné et signalé', async () => {
    const r = repo(
      [row({ id: 'late', email: 'late@x.fr', emailVerified: false })],
      {
        verifiedMeanwhile: ['late'],
      },
    );
    const res = await new AdminService(r, mailer()).deleteUnverifiedUsers(
      ['late'],
      'a',
    );
    expect(res.deleted).toEqual([]);
    expect(res.skipped).toEqual([
      { id: 'late', email: 'late@x.fr', why: 'verified' },
    ]);
  });
});

describe('AdminService.purgeStaleUnverified', () => {
  it('purge au-delà de 7 jours en épargnant les codes demandés depuis 24 h, et ne lève jamais', async () => {
    const r = repo([], { purged: 3 });
    await new AdminService(r, mailer()).purgeStaleUnverified();
    const [olderThan, recentCodeSince] = r.purgeUnverified.mock.calls[0] as [
      Date,
      Date,
    ];
    expect(Date.now() - olderThan.getTime()).toBeGreaterThanOrEqual(
      7 * 86_400_000 - 1000,
    );
    expect(Date.now() - recentCodeSince.getTime()).toBeLessThan(
      86_400_000 + 1000,
    );

    r.purgeUnverified.mockRejectedValueOnce(new Error('db down'));
    await expect(
      new AdminService(r, mailer()).purgeStaleUnverified(),
    ).resolves.toBeUndefined();
  });
});
