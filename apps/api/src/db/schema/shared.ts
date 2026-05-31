import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const sharedAccess = pgTable('shared_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedEmail: varchar('invited_email', { length: 255 }).notNull(),
  calendarToken: varchar('calendar_token', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
