import { z } from 'zod';

export const createSharedAccessSchema = z.object({
  invitedEmail: z.string().email(),
});
