import { z } from 'zod';

export const checkoutSchema = z.object({
  planKey: z.enum(['family', 'family_health']),
});
export type CheckoutDto = z.infer<typeof checkoutSchema>;
