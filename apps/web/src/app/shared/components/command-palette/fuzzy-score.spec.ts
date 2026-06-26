import { describe, expect, it } from 'vitest';
import { fuzzyScore } from './fuzzy-score';

describe('fuzzyScore', () => {
  it('given an exact substring match, when scored, then returns at least 100', () => {
    expect(fuzzyScore('bud', 'budget')).toBeGreaterThanOrEqual(100);
  });

  it('given a full match, when scored, then beats a partial substring match', () => {
    expect(fuzzyScore('budget', 'budget')).toBeGreaterThan(fuzzyScore('bud', 'budget'));
  });

  it('given a non-subsequence query, when scored, then returns 0', () => {
    expect(fuzzyScore('xyz', 'budget')).toBe(0);
  });

  it('given a scattered subsequence, when scored, then returns a positive score below substring scores', () => {
    const score = fuzzyScore('bgt', 'budget');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('given matches at word boundaries, when scored, then beats the same letters mid-word', () => {
    expect(fuzzyScore('mb', 'my budget')).toBeGreaterThan(fuzzyScore('mb', 'maybe'));
  });

  it('is case-insensitive', () => {
    expect(fuzzyScore('BUD', 'budget')).toBe(fuzzyScore('bud', 'BUDGET'));
  });
});
