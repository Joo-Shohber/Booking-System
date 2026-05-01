import { z } from "zod";

const WorkingHourSchema = z.object({
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:MM"),
});

export const CreateProviderDto = z.object({
  name: z.string().min(2).max(100).trim(),
  service: z.string().min(2).max(200).trim(),
  workingHours: z.array(WorkingHourSchema).min(1),
  slotDuration: z.number().min(5).max(480).default(30),
  capacity: z.number().min(1).default(1),
});

export const UpdateProviderDto = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  service: z.string().min(2).max(200).trim().optional(),
  workingHours: z.array(WorkingHourSchema).min(1).optional(),
  slotDuration: z.number().min(5).max(480).optional(),
  capacity: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const GenerateSlotsDto = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export type CreateProviderDtoType = z.infer<typeof CreateProviderDto>;
export type UpdateProviderDtoType = z.infer<typeof UpdateProviderDto>;
export type GenerateSlotsDtoType = z.infer<typeof GenerateSlotsDto>;
