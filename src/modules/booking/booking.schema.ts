import { z } from "zod";

export const CreateBookingDto = z.object({
  slotId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export type CreateBookingDtoType = z.infer<typeof CreateBookingDto>;
