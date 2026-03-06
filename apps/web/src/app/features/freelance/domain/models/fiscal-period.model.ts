export type FiscalPeriod = {
  readonly id: string;
  readonly quarter: string;
  readonly year: number;
  readonly revenue: number;
  readonly taxRate: number;
  readonly taxDue: number;
  readonly socialCharges: number;
  readonly provisioned: number;
  readonly declaredAt: string | null;
};
