import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { idempotency } from "../../middleware/idempotency";
import { Role } from "../../types/enums";
import * as controller from "./queue.controller";

const router = Router();

router.post(
  "/:slotId/join",
  authenticate,
  authorize(Role.USER),
  idempotency(),
  asyncHandler(controller.joinHandler),
);
router.post(
  "/:slotId/confirm",
  authenticate,
  authorize(Role.USER),
  idempotency(),
  asyncHandler(controller.confirmHandler),
);
router.get(
  "/:slotId/position",
  authenticate,
  asyncHandler(controller.getPositionHandler),
);
router.delete(
  "/:slotId/leave",
  authenticate,
  authorize(Role.USER),
  idempotency(),
  asyncHandler(controller.leaveHandler),
);

export default router;
