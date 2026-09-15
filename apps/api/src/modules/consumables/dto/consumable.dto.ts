import { z } from 'zod';

const optionalUuid = z.string().uuid().nullable().optional();
const isoDate = z.string().datetime({ offset: true });

export const createConsumableSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['ink', 'toner', 'paper', 'other']),
  quantity: z.coerce.number().int().min(0).default(0),
  minThreshold: z.coerce.number().int().min(0).default(0),
  unitPrice: z.coerce.number().min(0).default(0),
  lastRestocked: isoDate.optional(),
  installedAt: isoDate.optional(),
  estimatedLifetimeDays: z.coerce.number().int().min(0).optional(),
  memberId: optionalUuid,
});

// Whitelist explicite (pas de spread du body) : chaque champ modifiable est nommé et typé.
export const updateConsumableSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(['ink', 'toner', 'paper', 'other']).optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  minThreshold: z.coerce.number().int().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  lastRestocked: isoDate.nullable().optional(),
  installedAt: isoDate.nullable().optional(),
  estimatedLifetimeDays: z.coerce.number().int().min(0).nullable().optional(),
  memberId: optionalUuid,
});
