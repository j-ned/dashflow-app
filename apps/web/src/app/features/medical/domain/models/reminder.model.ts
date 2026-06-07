export type ReminderType = 'email' | 'ical';
export type ReminderTarget = 'medication' | 'appointment';

// Données en clair (non-E2EE, cf. http-reminder.gateway) : routage opérationnel seulement —
// `recipientEmail` lu par le serveur pour l'envoi, FK vers medication/appointment. Pas de contenu médical.
export type Reminder = {
  readonly id: string;
  readonly type: ReminderType;
  readonly target: ReminderTarget;
  readonly medicationId: string | null;
  readonly appointmentId: string | null;
  readonly recipientEmail: string;
  readonly enabled: boolean;
};
