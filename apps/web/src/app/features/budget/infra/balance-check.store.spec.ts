import { TestBed } from '@angular/core/testing';
import { BalanceCheckStore } from './balance-check.store';

describe('BalanceCheckStore', () => {
  beforeEach(() => localStorage.clear());

  it('ne connaît aucune vérification au départ', () => {
    expect(TestBed.inject(BalanceCheckStore).checkedAt('acc')).toBeNull();
  });

  it('mémorise la vérification par compte, et la retrouve après rechargement', () => {
    TestBed.inject(BalanceCheckStore).markChecked('acc', 1_789_000_000_000);
    expect(TestBed.inject(BalanceCheckStore).checkedAt('acc')).toBe(1_789_000_000_000);
    expect(TestBed.inject(BalanceCheckStore).checkedAt('autre')).toBeNull();

    TestBed.resetTestingModule();
    expect(TestBed.inject(BalanceCheckStore).checkedAt('acc')).toBe(1_789_000_000_000);
  });

  it('ignore une valeur corrompue dans le stockage', () => {
    localStorage.setItem('dashflow.balanceCheckedAt.acc', 'pas-un-nombre');
    expect(TestBed.inject(BalanceCheckStore).checkedAt('acc')).toBeNull();
  });
});
