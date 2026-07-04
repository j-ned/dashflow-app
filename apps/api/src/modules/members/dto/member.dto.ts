import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const updateMemberColorSchema = z.object({
  color: hexColor
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export const createMemberSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().max(255).optional(),
  color: hexColor.nullable().optional(),
});

export const updateMemberSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().max(255).optional(),
  color: hexColor.nullable().optional(),
});

export const encryptedMemberSchema = z.object({
  encryptedData: z.string().min(1),
});
