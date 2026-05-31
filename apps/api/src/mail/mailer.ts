export const MAILER = Symbol('MAILER');

export interface Mailer {
  sendVerificationCode(to: string, code: string): Promise<void>;
  sendPasswordResetCode(to: string, code: string): Promise<void>;
  sendCalendarInvitation(to: string, senderName: string, calendarToken: string): Promise<void>;
}
