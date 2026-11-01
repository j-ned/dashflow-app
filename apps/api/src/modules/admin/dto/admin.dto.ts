import { z } from 'zod';
import {
  DELETE_MAX_ACCOUNTS,
  NOTICE_MAX_RECIPIENTS,
  NOTICE_REASONS,
} from '../account-security';

export const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const sendNoticesSchema = z.object({
  reason: z.enum(NOTICE_REASONS),
  /** Absent : tous les comptes concernés par le motif. Présent : seulement ceux-là (envoi sélectif). */
  userIds: z
    .array(z.string().uuid())
    .min(1)
    .max(NOTICE_MAX_RECIPIENTS)
    .optional(),
});

export const deleteUsersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(DELETE_MAX_ACCOUNTS),
});
