import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RECOVERY_CHECK_EVERY_DAYS, RecoveryKeyCheckStore } from './recovery-key-check.store';

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 8, 17);

describe('RecoveryKeyCheckStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('jamais vérifiée → rappel dû', () => {
    const store = TestBed.inject(RecoveryKeyCheckStore);
    store.forUser('u1');

    expect(store.isDue(NOW)).toBe(true);
  });

  it.each([
    ['vérifiée hier', 1, false],
    [`vérifiée il y a ${RECOVERY_CHECK_EVERY_DAYS} jours`, RECOVERY_CHECK_EVERY_DAYS, false],
    [`vérifiée il y a ${RECOVERY_CHECK_EVERY_DAYS + 1} jours`, RECOVERY_CHECK_EVERY_DAYS + 1, true],
  ])('%s → dû = %s', (_label, daysAgo, due) => {
    const store = TestBed.inject(RecoveryKeyCheckStore);
    store.forUser('u1');
    store.markChecked(NOW - daysAgo * DAY_MS);

    expect(store.isDue(NOW)).toBe(due);
  });

  it('la date survit à un rechargement et reste propre à chaque compte', () => {
    const first = TestBed.inject(RecoveryKeyCheckStore);
    first.forUser('u1');
    first.markChecked(NOW);

    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(RecoveryKeyCheckStore);
    reloaded.forUser('u1');
    expect(reloaded.isDue(NOW)).toBe(false);

    reloaded.forUser('u2');
    expect(reloaded.isDue(NOW)).toBe(true);
  });
});
