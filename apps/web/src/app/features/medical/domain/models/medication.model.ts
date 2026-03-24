export type MedicationType = 'comprime' | 'gelule' | 'sirop' | 'patch' | 'injection' | 'gouttes' | 'creme' | 'autre';

export type Medication = {
  readonly id: string;
  readonly prescriptionId: string | null;
  readonly patientId: string;
  readonly name: string;
  readonly type: MedicationType;
  readonly dosage: string;
  readonly quantity: number;
  readonly dailyRate: number;
  readonly startDate: string;
  readonly alertDaysBefore: number;
  readonly skipDays: number[];
};

export type MedicationWithStock = Medication & {
  readonly daysRemaining: number;
  readonly takeDaysRemaining: number;
  readonly restDaysRemaining: number;
  readonly estimatedRunOut: string;
  readonly isLow: boolean;
};
