import { z } from 'zod';

export const GetSlotsQuery = z.object({
  providerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
});

export type GetSlotsQueryType = z.infer<typeof GetSlotsQuery>;