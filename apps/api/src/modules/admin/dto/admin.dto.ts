import { z } from 'zod';

export const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListQueryDto = z.infer<typeof listQuerySchema>;

export const overridePlanSchema = z.object({
  planKey: z.enum(['solo', 'family', 'family_health']),
});
export type OverridePlanDto = z.infer<typeof overridePlanSchema>;
