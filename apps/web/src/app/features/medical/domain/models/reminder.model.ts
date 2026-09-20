export type ReminderTarget = 'medication' | 'appointment';

// Un rappel est un raccourci d'export calendrier (.ics / Google) fabriqué dans le navigateur :
// l'API n'envoie rien et ne stocke que la cible (FK) et l'état, aucune donnée personnelle.
export type Reminder = {
  readonly id: string;
  readonly target: ReminderTarget;
  readonly medicationId: string | null;
  readonly appointmentId: string | null;
  readonly enabled: boolean;
};
