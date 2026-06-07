import { parseCsv, parseAmount, parseDate, mapRows } from './csv-import';

describe('parseCsv', () => {
  it("détecte le séparateur point-virgule et lit l'en-tête", () => {
    const r = parseCsv('Date;Libellé;Montant\n01/06/2026;Courses;-42,50');
    expect(r.headers).toEqual(['Date', 'Libellé', 'Montant']);
    expect(r.rows).toEqual([['01/06/2026', 'Courses', '-42,50']]);
  });
  it('gère la virgule comme séparateur', () => {
    const r = parseCsv('Date,Label,Amount\n2026-06-01,Rent,-800');
    expect(r.rows[0]).toEqual(['2026-06-01', 'Rent', '-800']);
  });
});

describe('parseAmount', () => {
  it.each([
    ['-42,50', -42.5],
    ['1 234,56', 1234.56],
    ['1234.56', 1234.56],
    ['(50,00)', -50],
    ['+12', 12],
  ])('parse %s → %s', (raw, expected) => {
    expect(parseAmount(raw as string)).toBe(expected);
  });
});

describe('parseDate', () => {
  it('DD/MM/YYYY', () => {
    expect(parseDate('01/06/2026', 'DD/MM/YYYY')).toBe('2026-06-01');
  });
  it('YYYY-MM-DD passthrough', () => {
    expect(parseDate('2026-06-01', 'YYYY-MM-DD')).toBe('2026-06-01');
  });
  it('MM/DD/YYYY', () => {
    expect(parseDate('06/01/2026', 'MM/DD/YYYY')).toBe('2026-06-01');
  });
});

describe('mapRows', () => {
  const rows = [
    ['01/06/2026', 'Courses', '-42,50'],
    ['28/06/2026', 'Salaire', '2850'],
  ];
  it('colonne signée → direction selon le signe, montant positif', () => {
    const out = mapRows(rows, {
      dateCol: 0,
      labelCol: 1,
      amountMode: { kind: 'signed', col: 2 },
      dateFormat: 'DD/MM/YYYY',
    });
    expect(out).toEqual([
      { date: '2026-06-01', label: 'Courses', amount: 42.5, direction: 'expense' },
      { date: '2026-06-28', label: 'Salaire', amount: 2850, direction: 'income' },
    ]);
  });
  it('débit/crédit séparés', () => {
    const dc = [
      ['01/06/2026', 'Courses', '42,50', ''],
      ['28/06/2026', 'Salaire', '', '2850'],
    ];
    const out = mapRows(dc, {
      dateCol: 0,
      labelCol: 1,
      amountMode: { kind: 'debitCredit', debitCol: 2, creditCol: 3 },
      dateFormat: 'DD/MM/YYYY',
    });
    expect(out[0]).toEqual({
      date: '2026-06-01',
      label: 'Courses',
      amount: 42.5,
      direction: 'expense',
    });
    expect(out[1]).toEqual({
      date: '2026-06-28',
      label: 'Salaire',
      amount: 2850,
      direction: 'income',
    });
  });
});
