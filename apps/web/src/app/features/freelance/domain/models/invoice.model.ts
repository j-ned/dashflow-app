export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'pending';

export type InvoiceLine = {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
};

export type Invoice = {
  readonly id: string;
  readonly reference: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly status: InvoiceStatus;
  readonly lines: readonly InvoiceLine[];
  readonly totalHt: number;
  readonly issuedAt: string;
  readonly dueDate: string;
  readonly paidAt: string | null;
  readonly notes: string;
};
