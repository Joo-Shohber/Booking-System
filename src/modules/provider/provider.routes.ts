import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { Role } from "../../types/enums";
import {
  CreateProviderDto,
  UpdateProviderDto,
  GenerateSlotsDto,
} from "./provider.schema";
import * as controller from "./provider.controller";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(Role.PROVIDER),
  validate(CreateProviderDto),
  asyncHandler(controller.createHandler),
);
router.get("/:id",
  authenticate, 
  asyncHandler(controller.getByIdHandler));
router.patch(
  "/:id",
  authenticate,
  authorize(Role.PROVIDER),
  validate(UpdateProviderDto),
  asyncHandler(controller.updateHandler),
);
router.post(
  "/:id/slots/generate",
  authenticate,
  authorize(Role.PROVIDER),
  validate(GenerateSlotsDto),
  asyncHandler(controller.generateSlotsHandler),
);

export default router;
