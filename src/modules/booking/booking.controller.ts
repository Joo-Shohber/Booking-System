import { Request, Response } from "express";
import * as bookingService from "./booking.service";
import { storeIdempotentResponse } from "../../middleware/idempotency";

export async function bookHandler(req: Request, res: Response): Promise<void> {
  const result = await bookingService.bookSlot(
    req.body.slotId,
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
  const booking = await bookingService.confirmBooking(
    req.params.id,
    req.user.userId,
  );
  res.status(200).json({ success: true, data: booking });
}

export async function cancelHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const booking = await bookingService.cancelBooking(
    req.params.id,
    req.user.userId,
  );
  res.status(200).json({ success: true, data: booking });
}

export async function getMyBookingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await bookingService.getMyBookings(req.user.userId, req.query);
  res.status(200).json({ success: true, data: result });
}

export async function getAllBookingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await bookingService.getAllBookings(req.query);
  res.status(200).json({ success: true, data: result });
}
