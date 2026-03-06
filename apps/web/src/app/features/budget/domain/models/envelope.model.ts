export type EnvelopeType = 'savings' | 'tax' | 'equipment' | 'vacation';

export type Envelope = {
  readonly id: string;
  readonly name: string;
  readonly type: EnvelopeType;
  readonly balance: number;
  readonly target: number | null;
  readonly color: string;
};