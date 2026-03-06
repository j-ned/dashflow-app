export type ConsumableCategory = 'ink' | 'toner' | 'paper' | 'other';

export type Consumable = {
  readonly id: string;
  readonly name: string;
  readonly category: ConsumableCategory;
  readonly quantity: number;
  readonly minThreshold: number;
  readonly unitPrice: number;
  readonly lastRestocked: string | null;
  readonly installedAt: string | null;
  readonly estimatedLifetimeDays: number | null;
};
