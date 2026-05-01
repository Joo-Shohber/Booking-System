import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import * as controller from "./auth.controller";
import {
  RegisterDto,
  LoginDto,
  resendOtpDto,
  VerifyEmailDto,
  ResetPasswordDto,
  forgetPasswordDto,
} from "./auth.schema";
import { authorize } from "../../middleware/authorize";
import { Role } from "../../types/enums";
const router = Router();

// Auth
router.post(
  "/register",
  validate(RegisterDto),
  asyncHandler(controller.registerHandler),
);
router.post(
  "/verify-email",
  validate(VerifyEmailDto),
  asyncHandler(controller.verifyEmailHandler),
);
router.post(
  "/resend-otp",
  validate(resendOtpDto),
  asyncHandler(controller.resendOtpHandler),
);
router.post(
  "/login",
  validate(LoginDto),
  asyncHandler(controller.loginHandler),
);

// Reset Password
router.post(
  "/forget-password",
  validate(forgetPasswordDto),
  asyncHandler(controller.forgetPasswordHandler),
);
router.post(
  "/reset-password",
  validate(ResetPasswordDto),
  asyncHandler(controller.resetPasswordHandler),
);

// Session
router.get("/refresh", asyncHandler(controller.refreshHandler));
router.get("/logout", authenticate, asyncHandler(controller.logoutHandler));



// Delete
router.delete(
  "/:id",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(controller.deleteUserHandler),
);

export default router;
