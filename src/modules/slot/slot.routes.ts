import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { GetSlotsQuery } from "./slot.schema";
import * as controller from "./slot.controller";

const router = Router();

router.get(
  "/",
  authenticate,
  validate(GetSlotsQuery, "query"),
  asyncHandler(controller.getSlotsHandler),
);

router.get("/:id", authenticate, asyncHandler(controller.getSlotByIdHandler));

export default router;
