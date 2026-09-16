import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@features/auth/auth.store';
import { SecurityEvent } from '@features/auth/domain/models/security-event.model';
import { formatWhen, SecurityActivitySection } from './security-activity-section';

const EVENTS: SecurityEvent[] = [
  {
    id: 'e1',
    type: 'login_failed',
    ip: '203.0.113.7',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0',
    at: new Date().toISOString(),
  },
  { id: 'e2', type: 'logout', ip: null, userAgent: null, at: new Date().toISOString() },
  { id: 'e3', type: 'type_futur', ip: null, userAgent: null, at: new Date().toISOString() },
];

function mount(securityEvents = vi.fn(() => Promise.resolve(EVENTS))) {
  TestBed.configureTestingModule({
    imports: [
      SecurityActivitySection,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [{ provide: AuthStore, useValue: { securityEvents } }],
  });
  const fixture = TestBed.createComponent(SecurityActivitySection);
  fixture.detectChanges();
  return { fixture, securityEvents };
}
type Cmp = {
  rows: () => { id: string; attention: boolean; where: string; label: string }[];
  error: () => boolean;
};

describe('SecurityActivitySection', () => {
  it('charge les événements au montage et les rend (attention sur les échecs, lieu résumé)', async () => {
    const { fixture, securityEvents } = mount();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(securityEvents).toHaveBeenCalledWith(30);
    const cmp = fixture.componentInstance as unknown as Cmp;
    const rows = cmp.rows();
    expect(rows).toHaveLength(3);
    expect(rows[0].attention).toBe(true);
    expect(rows[0].where).toBe('Firefox · Linux · 203.0.113.7');
    expect(rows[1].attention).toBe(false);
    expect(rows[1].where).toBe('');
    // Type inconnu du front : libellé générique, pas de crash.
    expect(rows[2].label).toContain('unknown');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="security-activity-list"] li'),
    ).toHaveLength(3);
  });

  it("erreur de chargement → message d'erreur, pas de liste", async () => {
    const { fixture } = mount(vi.fn(() => Promise.reject(new Error('boom'))));
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.componentInstance as unknown as Cmp).error()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe('formatWhen', () => {
  const now = new Date('2026-09-16T12:00:00Z');
  it('relatif sous 7 jours, absolu au-delà', () => {
    expect(formatWhen('2026-09-16T11:57:00Z', 'fr', now)).toMatch(/3 min/);
    expect(formatWhen('2026-09-16T09:00:00Z', 'fr', now)).toMatch(/3 h/);
    expect(formatWhen('2026-09-14T12:00:00Z', 'fr', now)).toMatch(/avant-hier|2 jours/);
    expect(formatWhen('2026-08-01T12:00:00Z', 'fr', now)).toMatch(/août/);
  });
});
