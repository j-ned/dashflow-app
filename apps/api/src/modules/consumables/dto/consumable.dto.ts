import { z } from 'zod';

export const createConsumableSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['ink', 'toner', 'paper', 'other']),
  quantity: z.coerce.number().int().min(0).default(0),
  minThreshold: z.coerce.number().int().min(0).default(0),
  unitPrice: z.coerce.number().min(0).default(0),
  lastRestocked: z.string().datetime({ offset: true }).optional(),
  installedAt: z.string().datetime({ offset: true }).optional(),
  estimatedLifetimeDays: z.coerce.number().int().min(0).optional(),
});

export type CreateConsumableDto = z.infer<typeof createConsumableSchema>;
