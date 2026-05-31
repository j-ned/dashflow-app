import { z } from 'zod';

export const updateMemberColorSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional().transform(v => v ?? null),
});
