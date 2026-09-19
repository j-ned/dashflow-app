import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AdminPage } from './admin-page';
import { AdminStore } from '@core/admin/admin.store';
import { anAdminUser } from '@core/admin/admin.builder';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';
import type { AdminUserView, NoticeSummary } from '@core/admin/admin.types';

const needsReconnect = (id: string): AdminUserView =>
  anAdminUser({
    id,
    email: `${id}@x.fr`,
    security: { status: 'action', issues: [{ reason: 'reconnect', severity: 'action' }] },
  });

const SUMMARY: NoticeSummary = {
  reconnect: { eligible: 3, onCooldown: 1 },
  enable_encryption: { eligible: 0, onCooldown: 0 },
  recovery_key: { eligible: 0, onCooldown: 0 },
  enable_2fa: { eligible: 0, onCooldown: 0 },
};

describe('AdminPage — relances', () => {
  let fixture: ComponentFixture<AdminPage>;
  let el: HTMLElement;
  const confirm = { confirm: vi.fn() };
  const toaster = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const store = {
    users: signal<readonly AdminUserView[]>([]),
    total: signal(0),
    loading: signal(false),
    summary: signal<NoticeSummary | null>(SUMMARY),
    sending: signal(false),
    loadUsers: vi.fn().mockResolvedValue(undefined),
    loadSummary: vi.fn().mockResolvedValue(undefined),
    sendNotices: vi.fn(),
  };
  const button = (id: string) => el.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;

  beforeEach(() => {
    vi.clearAllMocks();
    store.users.set([needsReconnect('a'), needsReconnect('b'), anAdminUser({ id: 'ok' })]);
    TestBed.configureTestingModule({
      imports: [
        AdminPage,
        TranslocoTestingModule.forRoot({
          langs: { fr: {} },
          translocoConfig: { defaultLang: 'fr' },
        }),
      ],
      providers: [
        { provide: AdminStore, useValue: store },
        { provide: ConfirmService, useValue: confirm },
        { provide: Toaster, useValue: toaster },
      ],
    });
    fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it("charge la liste et le résumé des relances à l'ouverture", () => {
    expect(store.loadUsers).toHaveBeenCalled();
    expect(store.loadSummary).toHaveBeenCalled();
  });

  it("rien de coché : « envoyer à la sélection » est inactif, l'envoi groupé exclut les comptes en délai", () => {
    expect(button('admin-send-selected').disabled).toBe(true);
    expect(button('admin-send-all').disabled).toBe(false);
    expect(button('admin-send-all').textContent).toContain('admin.notices.sendAll');
  });

  it("envoi sélectif confirmé : n'envoie que les comptes cochés, puis recharge et vide la sélection", async () => {
    confirm.confirm.mockResolvedValue(true);
    store.sendNotices.mockResolvedValue({
      reason: 'reconnect',
      sent: [{ id: 'a', email: 'a@x.fr' }],
      skipped: [],
    });
    el.querySelector<HTMLInputElement>(
      'tr[data-user-id="a"] [data-testid="admin-select-user"]',
    )!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(button('admin-send-selected').disabled).toBe(false);

    button('admin-send-selected').click();
    await fixture.whenStable();

    expect(confirm.confirm).toHaveBeenCalledTimes(1);
    expect(store.sendNotices).toHaveBeenCalledWith('reconnect', ['a']);
    expect(toaster.success).toHaveBeenCalledWith('admin.notices.toast.sent', { sent: 1 });
    expect(store.loadSummary).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    expect(button('admin-send-selected').disabled).toBe(true);
  });

  it('confirmation refusée : rien ne part', async () => {
    confirm.confirm.mockResolvedValue(false);
    button('admin-send-all').click();
    await fixture.whenStable();
    expect(store.sendNotices).not.toHaveBeenCalled();
  });

  it('envoi groupé : pas de liste de comptes, et les ignorés sont annoncés', async () => {
    confirm.confirm.mockResolvedValue(true);
    store.sendNotices.mockResolvedValue({
      reason: 'reconnect',
      sent: [{ id: 'a', email: 'a@x.fr' }],
      skipped: [{ id: 'b', email: 'b@x.fr', why: 'cooldown' }],
    });
    button('admin-send-all').click();
    await fixture.whenStable();
    expect(store.sendNotices).toHaveBeenCalledWith('reconnect', undefined);
    expect(toaster.success).toHaveBeenCalledWith('admin.notices.toast.sentWithSkipped', {
      sent: 1,
      skipped: 1,
    });
  });
});
