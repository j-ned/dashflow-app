import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoLockStore, DEFAULT_AUTO_LOCK_MINUTES } from './auto-lock.store';
import { CryptoStore } from './crypto.store';

function mount(unlocked = true) {
  const lock = vi.fn(() => Promise.resolve());
  TestBed.configureTestingModule({
    providers: [{ provide: CryptoStore, useValue: { isUnlocked: () => unlocked, lock } }],
  });
  return { store: TestBed.inject(AutoLockStore), lock };
}

describe('AutoLockStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('défaut 15 min ; setMinutes persiste et refuse une valeur hors liste', () => {
    const { store } = mount();
    expect(store.minutes()).toBe(DEFAULT_AUTO_LOCK_MINUTES);
    store.setMinutes(30);
    expect(localStorage.getItem('dashflow.autoLockMinutes')).toBe('30');
    store.setMinutes(7);
    expect(store.minutes()).toBe(30);
  });

  it('verrouille la clé après le délai sans activité, et notifie via lockedAt', async () => {
    const { store, lock } = mount();
    store.setMinutes(5);
    store.start();
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(lock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(61_000);
    expect(lock).toHaveBeenCalledTimes(1);
    expect(store.lockedAt()).toBe(1);
  });

  it("une activité repousse l'échéance", async () => {
    const { store, lock } = mount();
    store.setMinutes(5);
    store.start();
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    document.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(lock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(61_000);
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('0 = jamais : aucun verrouillage', async () => {
    const { store, lock } = mount();
    store.setMinutes(0);
    store.start();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect(lock).not.toHaveBeenCalled();
  });

  it('clé déjà verrouillée : rien à faire, pas de notification', async () => {
    const { store, lock } = mount(false);
    store.setMinutes(5);
    store.start();
    await vi.advanceTimersByTimeAsync(6 * 60_000);
    expect(lock).not.toHaveBeenCalled();
    expect(store.lockedAt()).toBe(0);
  });

  it('isExpired : lit la dernière activité persistée (survit à un rechargement)', () => {
    localStorage.setItem('dashflow.lastActivityAt', String(Date.now() - 20 * 60_000));
    const { store } = mount();
    expect(store.isExpired()).toBe(true);
    store.setMinutes(30);
    expect(store.isExpired()).toBe(false);
    store.setMinutes(0);
    expect(store.isExpired()).toBe(false);
  });

  it("isExpired : sans activité connue, n'expire pas", () => {
    const { store } = mount();
    expect(store.isExpired()).toBe(false);
  });
});
