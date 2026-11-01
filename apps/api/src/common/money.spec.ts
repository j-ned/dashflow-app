import { describe, it, expect } from 'vitest';
import {
  addMoney,
  fromCents,
  money,
  moneyNumber,
  nonNegativeMoney,
  positiveMoney,
  smallPositiveRate,
  toCents,
} from './money';

describe('toCents / fromCents', () => {
  it.each([
    ['0', 0],
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['-3.07', -307],
    [1.1, 110],
    [0.2, 20],
  ])('%s → %d centimes', (input, cents) => {
    expect(toCents(input)).toBe(cents);
  });

  it('fromCents est canonique (2 décimales, signe)', () => {
    expect(fromCents(1250)).toBe('12.50');
    expect(fromCents(-307)).toBe('-3.07');
    expect(fromCents(5)).toBe('0.05');
  });

  it('refuse une entrée non monétaire au lieu d’arrondir en silence', () => {
    expect(() => toCents('abc')).toThrow(RangeError);
    expect(() => toCents('1.005')).toThrow(RangeError);
  });
});

describe('addMoney', () => {
  it('0.1 + 0.2 = 0.3 (centimes entiers)', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(addMoney(10.1, 0.2)).toBe(10.3);
    expect(addMoney(100.1, -0.2)).toBe(99.9);
  });
});

describe('money (Zod)', () => {
  it.each([
    [12.5, '12.50'],
    ['12.5', '12.50'],
    ['  7 ', '7.00'],
    ['-3', '-3.00'],
    [0, '0.00'],
    ['9999999999.99', '9999999999.99'],
  ])('accepte %s → %s', (input, out) => {
    expect(money.parse(input)).toBe(out);
  });

  it.each([
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['abc', 'abc'],
    ['3 décimales', '1.005'],
    ['notation scientifique', '1e21'],
    ['dépassement numeric(12,2)', '10000000000'],
    ['vide', ''],
    ['NaN number', Number.NaN],
    ['Infinity number', Number.POSITIVE_INFINITY],
    ['objet', { a: 1 }],
  ])('refuse %s', (_label, input) => {
    expect(money.safeParse(input).success).toBe(false);
  });

  it('nonNegativeMoney refuse le négatif, accepte 0', () => {
    expect(nonNegativeMoney.safeParse('-0.01').success).toBe(false);
    expect(nonNegativeMoney.parse('0')).toBe('0.00');
  });

  it('positiveMoney refuse 0 et le négatif', () => {
    expect(positiveMoney.safeParse('0').success).toBe(false);
    expect(positiveMoney.safeParse(-5).success).toBe(false);
    expect(positiveMoney.parse('0.01')).toBe('0.01');
  });

  it('moneyNumber renvoie un number à 2 décimales', () => {
    expect(moneyNumber.parse('12.5')).toBe(12.5);
    expect(moneyNumber.safeParse('1.005').success).toBe(false);
  });

  it('smallPositiveRate borne à 999.99 (numeric(5,2))', () => {
    expect(smallPositiveRate.parse('1.5')).toBe('1.50');
    expect(smallPositiveRate.safeParse('1000').success).toBe(false);
    expect(smallPositiveRate.safeParse('0').success).toBe(false);
  });
});
