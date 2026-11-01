export type ParsedTransaction = {
  readonly date: string;
  readonly label: string;
  readonly amount: number;
  readonly direction: 'income' | 'expense';
};

export type CsvMapping = {
  readonly dateCol: number;
  readonly labelCol: number;
  readonly amountMode:
    | { readonly kind: 'signed'; readonly col: number }
    | { readonly kind: 'debitCredit'; readonly debitCol: number; readonly creditCol: number };
  readonly dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
};
