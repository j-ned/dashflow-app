export type Prescription = {
  readonly id: string;
  readonly appointmentId: string | null;
  readonly practitionerId: string | null;
  readonly patientId: string;
  readonly issuedDate: string;
  readonly validUntil: string | null;
  readonly documentUrl: string | null;
  readonly notes: string | null;
};
