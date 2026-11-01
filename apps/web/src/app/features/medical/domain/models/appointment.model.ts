export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export type Appointment = {
  readonly id: string;
  readonly patientId: string;
  readonly practitionerId: string;
  readonly date: string;
  readonly time: string;
  readonly status: AppointmentStatus;
  readonly reason: string | null;
  readonly outcome: string | null;
};
