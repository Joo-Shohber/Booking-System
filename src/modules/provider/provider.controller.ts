import { Request, Response } from "express";
import * as providerService from "./provider.service";

export async function createHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const provider = await providerService.createProvider(
    req.user.userId,
    req.body,
  );
  res.status(201).json({ success: true, data: provider });
}

export async function getByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const provider = await providerService.getProviderById(req.params.id);
  res.status(200).json({ success: true, data: provider });
}

export async function updateHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const provider = await providerService.updateProvider(
    req.params.id,
    req.user.userId,
    req.body,
  );
  res.status(200).json({ success: true, data: provider });
}

export async function generateSlotsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { startDate, endDate } = req.body;

  const result = await providerService.generateProviderSlots(
    req.params.id,
    req.user.userId,
    new Date(startDate),
    new Date(endDate),
  );
  res.status(201).json({ success: true, data: result });
}
