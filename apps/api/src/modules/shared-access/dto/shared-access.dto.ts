import { z } from 'zod';

export const createSharedAccessSchema = z.object({
  invitedEmail: z.string().email(),
});

export type CreateSharedAccessDto = z.infer<typeof createSharedAccessSchema>;
