import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { idempotency } from "../../middleware/idempotency";
import { Role } from "../../types/enums";
import { CreateBookingDto } from "./booking.schema";
import * as controller from "./booking.controller";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(Role.USER),
  idempotency(),
  validate(CreateBookingDto),
  asyncHandler(controller.bookHandler),
);

router.patch(
  "/:id/confirm",
  authenticate,
  authorize(Role.USER),
  asyncHandler(controller.confirmHandler),
);

router.get("/me", authenticate, asyncHandler(controller.getMyBookingsHandler));

router.delete(
  "/:id",
  authenticate,
  authorize(Role.USER),
  asyncHandler(controller.cancelHandler),
);

router.get(
  "/",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(controller.getAllBookingsHandler),
);

export default router;
