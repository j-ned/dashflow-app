export type EnvelopeType = 'épargne' | 'impôts' | 'équipement' | 'vacances';

export type Envelope = {
  readonly id: string;
  readonly memberId: string | null;
  readonly name: string;
  readonly type: EnvelopeType;
  readonly balance: number;
  readonly target: number | null;
  readonly color: string;
  readonly dueDay: number | null;
};
