import { ParsedTransaction, CsvMapping } from './models/parsed-transaction.model';

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim =
    (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const split = (line: string) => line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  return { headers: split(lines[0]), rows: lines.slice(1).map(split) };
}

export function parseAmount(raw: string): number {
  const neg = /^\(.*\)$/.test(raw.trim()) || raw.trim().startsWith('-');
  const cleaned = raw.replace(/[()\s]/g, '').replace(/[^0-9.,-]/g, '');
  const norm = cleaned
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/-/g, '');
  const n = Number(norm) || 0;
  return neg ? -n : n;
}

export function parseDate(raw: string, format: CsvMapping['dateFormat']): string {
  const t = raw.trim();
  if (format === 'YYYY-MM-DD') return t.slice(0, 10);
  const [a, b, y] = t.split(/[/.-]/);
  const dd = format === 'DD/MM/YYYY' ? a : b;
  const mm = format === 'DD/MM/YYYY' ? b : a;
  return `${y}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export function mapRows(rows: string[][], m: CsvMapping): ParsedTransaction[] {
  return rows.map((r) => {
    let amount: number;
    if (m.amountMode.kind === 'signed') amount = parseAmount(r[m.amountMode.col] ?? '0');
    else {
      const debit = parseAmount(r[m.amountMode.debitCol] ?? '0');
      const credit = parseAmount(r[m.amountMode.creditCol] ?? '0');
      amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    }
    return {
      date: parseDate(r[m.dateCol] ?? '', m.dateFormat),
      label: r[m.labelCol] ?? '',
      amount: Math.abs(amount),
      direction: amount >= 0 ? 'income' : 'expense',
    };
  });
}
