import { describe, expect, it } from 'vitest';
import { Appointment } from './models/appointment.model';
import { groupAppointments, localIsoDate } from './appointment-groups';

const TODAY = '2026-03-16';

function appt(id: string, date: string, time = '09:00'): Appointment {
  return {
    id,
    patientId: 'p1',
    practitionerId: 'pr1',
    date,
    time,
    status: 'scheduled',
    reason: null,
    outcome: null,
  };
}

const ids = (appointments: readonly Appointment[]) => appointments.map((a) => a.id);

describe('groupAppointments', () => {
  it('ordre de la capture du README (18, 22 mars, 5 avril, 28, 15 mars) → cette semaine, plus tard, passés', () => {
    const groups = groupAppointments(
      [
        appt('18mars', '2026-03-18'),
        appt('22mars', '2026-03-22'),
        appt('5avril', '2026-04-05'),
        appt('28mars', '2026-03-28'),
        appt('15mars', '2026-03-15'),
      ],
      TODAY,
    );

    expect(groups.map((g) => g.key)).toEqual(['thisWeek', 'later', 'past']);
    expect(ids(groups[0].appointments)).toEqual(['18mars', '22mars']);
    expect(ids(groups[1].appointments)).toEqual(['28mars', '5avril']);
    expect(ids(groups[2].appointments)).toEqual(['15mars']);
  });

  it.each([
    ['aujourd’hui', '2026-03-16', 'thisWeek'],
    ['dans 6 jours', '2026-03-22', 'thisWeek'],
    ['dans 7 jours', '2026-03-23', 'later'],
    ['hier', '2026-03-15', 'past'],
  ])('borne : %s → %s', (_label, date, expected) => {
    expect(groupAppointments([appt('a', date)], TODAY)[0].key).toBe(expected);
  });

  it('la semaine enjambe la fin de mois', () => {
    const [group] = groupAppointments([appt('a', '2026-04-02')], '2026-03-28');

    expect(group.key).toBe('thisWeek');
  });

  it('même jour : trié par heure ; passés : du plus récent au plus ancien', () => {
    const groups = groupAppointments(
      [
        appt('apm', '2026-03-17', '14:30'),
        appt('matin', '2026-03-17', '08:15'),
        appt('vieux', '2026-01-10'),
        appt('recent', '2026-03-10'),
      ],
      TODAY,
    );

    expect(ids(groups[0].appointments)).toEqual(['matin', 'apm']);
    expect(ids(groups[1].appointments)).toEqual(['recent', 'vieux']);
  });

  it('omet les groupes vides et ne modifie pas la liste reçue', () => {
    const input = [appt('b', '2026-03-20'), appt('a', '2026-03-17')];

    const groups = groupAppointments(input, TODAY);

    expect(groups.map((g) => g.key)).toEqual(['thisWeek']);
    expect(ids(input)).toEqual(['b', 'a']);
    expect(groupAppointments([], TODAY)).toEqual([]);
  });
});

describe('localIsoDate', () => {
  it('formate la date locale sans décalage UTC (23 h 30 reste le même jour)', () => {
    expect(localIsoDate(new Date(2026, 2, 5, 23, 30))).toBe('2026-03-05');
  });
});
