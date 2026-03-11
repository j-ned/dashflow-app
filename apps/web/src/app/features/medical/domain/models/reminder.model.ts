export type ReminderType = 'email' | 'ical';
export type ReminderTarget = 'medication' | 'appointment';

export type Reminder = {
  readonly id: string;
  readonly type: ReminderType;
  readonly target: ReminderTarget;
  readonly medicationId: string | null;
  readonly appointmentId: string | null;
  readonly recipientEmail: string;
  readonly enabled: boolean;
};
