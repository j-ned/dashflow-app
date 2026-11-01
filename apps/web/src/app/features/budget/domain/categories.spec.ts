import { categoryMeta, CATEGORY_GROUPS, normalizeCategory } from './categories';

describe('categories taxonomy', () => {
  it('expose des groupes non vides', () => {
    expect(CATEGORY_GROUPS.length).toBeGreaterThan(0);
    expect(CATEGORY_GROUPS[0].categories.length).toBeGreaterThan(0);
  });

  it('categoryMeta résout un code connu', () => {
    const meta = categoryMeta('food');
    expect(meta.label).toBe('Alimentation');
    expect(meta.group).toBeTruthy();
  });

  it('categoryMeta retombe sur « Autre » pour un code inconnu', () => {
    expect(categoryMeta('inexistant').key).toBe('other');
  });

  it('normalizeCategory reste fonctionnel (rétro-compat)', () => {
    expect(normalizeCategory('ALIMENTATION').key).toBe('food');
  });
});
