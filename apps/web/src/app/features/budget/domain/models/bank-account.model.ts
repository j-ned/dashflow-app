export type BankAccountType = 'courant' | 'épargne' | 'carte' | 'espèces';

export const BANK_ACCOUNT_TYPES: readonly BankAccountType[] = [
  'courant',
  'épargne',
  'carte',
  'espèces',
];

export type BankAccount = {
  id: string;
  name: string;
  type: BankAccountType;
  initialBalance: number;
  color: string | null;
  dotColor: string | null;
};
