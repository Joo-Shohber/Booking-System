import { Request, Response } from "express";
import * as queueService from "./queue.service";
import { storeIdempotentResponse } from "../../middleware/idempotency";

export async function joinHandler(req: Request, res: Response): Promise<void> {
  const result = await queueService.joinQueue(
    req.params.slotId,
    req.user.userId,
  );
  const responseData = { success: true, data: result };

  if (res.locals.idempotencyKey) {
    await storeIdempotentResponse(res.locals.idempotencyKey, responseData);
  }

  res.status(201).json(responseData);
}

export async function confirmHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await queueService.confirmQueueSlot(
    req.params.slotId,
    req.user.userId,
  );
  const responseData = { success: true, data: result };

  if (res.locals.idempotencyKey) {
    await storeIdempotentResponse(res.locals.idempotencyKey, responseData);
  }

  res.status(200).json(responseData);
}

export async function getPositionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const position = await queueService.getPosition(
    req.params.slotId,
    req.user.userId,
  );
  res.status(200).json({ success: true, data: position });
}

export async function leaveHandler(req: Request, res: Response): Promise<void> {
  const result = await queueService.leaveQueue(
    req.params.slotId,
    req.user.userId,
  );

  if (res.locals.idempotencyKey) {
    await storeIdempotentResponse(res.locals.idempotencyKey, result);
  }

  res.status(200).json({ success: true, data: result });
}
