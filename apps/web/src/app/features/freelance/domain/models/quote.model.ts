export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export type QuoteLine = {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
};

export type Quote = {
  readonly id: string;
  readonly reference: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly status: QuoteStatus;
  readonly lines: readonly QuoteLine[];
  readonly totalHt: number;
  readonly issuedAt: string;
  readonly validUntil: string;
  readonly notes: string;
};
