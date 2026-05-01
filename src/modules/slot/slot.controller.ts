import { Request, Response } from "express";
import { slotService } from "./slot.service";

export async function getSlotsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { providerId, date } = req.query as {
    providerId: string;
    date: string;
  };

  const slots = await slotService.getSlots(providerId, date, req.user.userId);
  res.status(200).json({ success: true, data: slots });
}

export async function getSlotByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const slot = await slotService.getSlotById(req.params.id, req.user.userId);
  res.status(200).json({ success: true, data: slot });
}
