import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Celebration } from './celebration';

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('Celebration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('celebrate() ajoute une rafale de particules', () => {
    stubReducedMotion(false);
    const svc = TestBed.inject(Celebration);
    expect(svc.runs().length).toBe(0);
    svc.celebrate();
    expect(svc.runs().length).toBe(1);
    expect(svc.runs()[0].particles.length).toBeGreaterThan(0);
  });

  it('respecte prefers-reduced-motion (no-op)', () => {
    stubReducedMotion(true);
    const svc = TestBed.inject(Celebration);
    svc.celebrate();
    expect(svc.runs().length).toBe(0);
  });
});
