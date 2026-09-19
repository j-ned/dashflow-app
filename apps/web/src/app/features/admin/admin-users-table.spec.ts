import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { AdminUsersTable } from './admin-users-table';
import { anAdminUser } from '@core/admin/admin.builder';
import type { AdminUserView } from '@core/admin/admin.types';

describe('AdminUsersTable', () => {
  let fixture: ComponentFixture<AdminUsersTable>;

  function render(users: AdminUserView[], selected: string[] = []) {
    fixture = TestBed.createComponent(AdminUsersTable);
    fixture.componentRef.setInput('users', users);
    fixture.componentRef.setInput('total', users.length);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.componentRef.setInput('selectedIds', new Set(selected));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        AdminUsersTable,
        TranslocoTestingModule.forRoot({
          langs: { fr: {} },
          translocoConfig: { defaultLang: 'fr' },
        }),
      ],
    });
  });

  it('affiche une pastille par compte, avec son statut', () => {
    const el = render([
      anAdminUser({ id: 'ok' }),
      anAdminUser({
        id: 'old',
        security: { status: 'action', issues: [{ reason: 'reconnect', severity: 'action' }] },
      }),
    ]);
    const badges = [...el.querySelectorAll('[data-testid="admin-security-badge"]')];
    expect(badges.map((b) => b.getAttribute('data-status'))).toEqual(['ok', 'action']);
    expect(el.textContent).toContain('admin.security.issue.reconnect');
  });

  it('ne propose la sélection que pour les comptes qui ont quelque chose à recevoir', () => {
    const el = render([
      anAdminUser({ id: 'ok' }),
      anAdminUser({ id: 'demo', isDemoAccount: true, security: { status: 'exempt', issues: [] } }),
      anAdminUser({
        id: 'old',
        security: { status: 'action', issues: [{ reason: 'reconnect', severity: 'action' }] },
      }),
    ]);
    const boxes = el.querySelectorAll('[data-testid="admin-select-user"]');
    expect(boxes).toHaveLength(1);
    expect(boxes[0].closest('tr')?.getAttribute('data-user-id')).toBe('old');
  });

  it('émet toggleSelect au clic et reflète la sélection reçue', () => {
    const user = anAdminUser({
      id: 'old',
      security: { status: 'action', issues: [{ reason: 'reconnect', severity: 'action' }] },
    });
    const el = render([user], ['old']);
    const box = el.querySelector<HTMLInputElement>('[data-testid="admin-select-user"]')!;
    expect(box.checked).toBe(true);

    const emitted: string[] = [];
    fixture.componentInstance.toggleSelect.subscribe((id) => emitted.push(id));
    box.dispatchEvent(new Event('change'));
    expect(emitted).toEqual(['old']);
  });

  it('rappelle la dernière relance quand il y en a une', () => {
    const el = render([
      anAdminUser({
        security: { status: 'action', issues: [{ reason: 'reconnect', severity: 'action' }] },
        lastNotice: { reason: 'reconnect', at: '2026-09-18T10:00:00.000Z' },
      }),
    ]);
    expect(el.querySelector('[data-testid="admin-last-notice"]')).not.toBeNull();
  });
});
