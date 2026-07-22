import { immediatePostingFor } from './immediate-posting';
import { RecurringEntry, RecurringEntryType } from './models/recurring-entry.model';

const entry = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'r1',
  memberId: null,
  accountId: 'a',
  toAccountId: null,
  label: 'Salaire',
  amount: 2500,
  type: 'income',
  dayOfMonth: 5,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
  ...p,
});

const CTX = { today: '2026-06-10', currentMonth: '2026-06', currentDay: 10 };

describe('immediatePostingFor', () => {
  describe('Given une échéance récurrente (dayOfMonth renseigné)', () => {
    it('When le jour est déjà passé (dayOfMonth < currentDay) Then poste au mois courant, direction income', () => {
      const created = entry({ type: 'income', dayOfMonth: 5, amount: 2500 });

      const posting = immediatePostingFor(created, CTX);

      expect(posting).not.toBeNull();
      expect(posting).toMatchObject({
        entry: created,
        month: '2026-06',
        date: '2026-06-05',
        direction: 'income',
        amount: 2500,
      });
    });

    it('When le jour vaut exactement currentDay Then l’échéance est due (borne inclusive)', () => {
      const posting = immediatePostingFor(entry({ dayOfMonth: 10 }), CTX);

      expect(posting).toMatchObject({ month: '2026-06', date: '2026-06-10' });
    });

    it('When le jour n’est pas encore passé (dayOfMonth > currentDay) Then null (reste projeté)', () => {
      expect(immediatePostingFor(entry({ type: 'income', dayOfMonth: 20 }), CTX)).toBeNull();
    });

    it('When c’est une dépense due Then poste avec direction expense', () => {
      const posting = immediatePostingFor(
        entry({ type: 'expense', dayOfMonth: 5, amount: 800 }),
        CTX,
      );

      expect(posting).toMatchObject({ direction: 'expense', date: '2026-06-05', amount: 800 });
    });

    it('When c’est un virement récurrent dû Then poste avec direction transfer', () => {
      const posting = immediatePostingFor(entry({ type: 'transfer', dayOfMonth: 5 }), CTX);

      expect(posting).toMatchObject({ direction: 'transfer', date: '2026-06-05' });
    });

    it('When dayOfMonth < 10 Then la date est zéro-paddée (YYYY-MM-DD)', () => {
      expect(immediatePostingFor(entry({ dayOfMonth: 3 }), CTX)?.date).toBe('2026-06-03');
    });

    it('When endDate est antérieure au mois de post Then null', () => {
      expect(immediatePostingFor(entry({ dayOfMonth: 5, endDate: '2026-05-31' }), CTX)).toBeNull();
    });

    it('When endDate couvre le mois de post Then poste normalement', () => {
      expect(
        immediatePostingFor(entry({ dayOfMonth: 5, endDate: '2026-06-30' }), CTX),
      ).not.toBeNull();
    });
  });

  describe('Given une échéance ponctuelle (dayOfMonth null, date renseignée)', () => {
    it.each<RecurringEntryType>(['income', 'expense'])(
      'When date <= today (type %s) Then poste à entry.date, mois dérivé de la date',
      (type) => {
        const created = entry({ type, dayOfMonth: null, date: '2026-06-08', amount: 500 });

        const posting = immediatePostingFor(created, CTX);

        expect(posting).toMatchObject({
          month: '2026-06',
          date: '2026-06-08',
          direction: type,
          amount: 500,
        });
      },
    );

    it('When date == today Then l’échéance est due (borne inclusive)', () => {
      expect(immediatePostingFor(entry({ dayOfMonth: null, date: '2026-06-10' }), CTX)?.date).toBe(
        '2026-06-10',
      );
    });

    it('When date > today Then null (échéance future)', () => {
      expect(immediatePostingFor(entry({ dayOfMonth: null, date: '2026-06-15' }), CTX)).toBeNull();
    });

    it('When date null et dayOfMonth null Then null', () => {
      expect(immediatePostingFor(entry({ dayOfMonth: null, date: null }), CTX)).toBeNull();
    });

    it('When date d’un mois passé Then month est dérivé de la date, pas de currentMonth', () => {
      const posting = immediatePostingFor(entry({ dayOfMonth: null, date: '2026-05-20' }), CTX);

      expect(posting).toMatchObject({ month: '2026-05', date: '2026-05-20' });
    });

    it('When type spending daté <= today Then poste comme une dépense (direction expense)', () => {
      const posting = immediatePostingFor(
        entry({ type: 'spending', dayOfMonth: null, date: '2026-06-08', amount: 30 }),
        CTX,
      );

      expect(posting).toMatchObject({ direction: 'expense', date: '2026-06-08', amount: 30 });
    });
  });

  describe('Given des échéances non postables', () => {
    it('When accountId est null Then null', () => {
      expect(immediatePostingFor(entry({ accountId: null, dayOfMonth: 5 }), CTX)).toBeNull();
    });

    it('When le type est annual_expense Then null (montant lissé sur 12 mois, hors post immédiat)', () => {
      expect(immediatePostingFor(entry({ type: 'annual_expense', dayOfMonth: 5 }), CTX)).toBeNull();
    });
  });
});
