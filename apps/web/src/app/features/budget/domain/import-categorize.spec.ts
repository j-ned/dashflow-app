import { suggestCategory } from './import-categorize';

describe('suggestCategory', () => {
  it.each([
    ['CARREFOUR MARKET', 'food'],
    ['Virement loyer', 'housing'],
    ['SNCF BILLET', 'transport'],
    ['Cotisation NETFLIX', 'subscription'],
    ['Truc inconnu xyz', 'other'],
  ])('« %s » → %s', (label, code) => {
    expect(suggestCategory(label as string)).toBe(code);
  });
});
