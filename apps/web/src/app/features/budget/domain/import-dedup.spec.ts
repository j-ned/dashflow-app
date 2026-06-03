import { markDuplicates } from './import-dedup';
import { ParsedTransaction } from './models/parsed-transaction.model';

const p = (date: string, label: string, amount: number): ParsedTransaction => ({ date, label, amount, direction: 'expense' });

describe('markDuplicates', () => {
  it('marque doublon si une transaction existante a même date+montant+libellé', () => {
    const existing = [{ date: '2026-06-01', amount: 42.5, note: 'Courses' }];
    const out = markDuplicates([p('2026-06-01', 'Courses', 42.5), p('2026-06-02', 'Essence', 60)], existing);
    expect(out[0].duplicate).toBe(true);
    expect(out[1].duplicate).toBe(false);
  });

  it('insensible casse/accents sur le libellé', () => {
    const existing = [{ date: '2026-06-01', amount: 42.5, note: 'COURSES' }];
    const out = markDuplicates([p('2026-06-01', 'courses', 42.5)], existing);
    expect(out[0].duplicate).toBe(true);
  });
});
