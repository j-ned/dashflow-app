import { withAutoPostDefaults } from './recurring-entry.adapter';

const base = {
  id: 'r1',
  memberId: null,
  accountId: 'a',
  toAccountId: null,
  label: 'Loyer',
  amount: 800,
  type: 'expense' as const,
  dayOfMonth: 5,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
};

describe('withAutoPostDefaults', () => {
  it('applique autoPost=false et autoPostSince=null quand absents (récurrence existante)', () => {
    const result = withAutoPostDefaults({ ...base } as never);
    expect(result.autoPost).toBe(false);
    expect(result.autoPostSince).toBeNull();
  });

  it('préserve les valeurs présentes', () => {
    const result = withAutoPostDefaults({
      ...base,
      autoPost: true,
      autoPostSince: '2026-05',
    } as never);
    expect(result.autoPost).toBe(true);
    expect(result.autoPostSince).toBe('2026-05');
  });
});
