import { z } from 'zod';

export const createSharedAccessSchema = z.object({
  invitedEmail: z.string().trim().toLowerCase().email().max(254),
});
