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
import { Role } from "../../types/enums";
import { authorize } from "../../middleware/authorize";
import { uploadImage } from "../../middleware/multer";
import passport from "passport";

const router = Router();

/* ==================== Auth ==================== */
router.post(
  "/register",
  validate(RegisterDto),
  asyncHandler(controller.registerHandler),
);

router.post(
  "/login",
  validate(LoginDto),
  asyncHandler(controller.loginHandler),
);

/* ==================== Email Verification ==================== */
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

/* ==================== Password ==================== */
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

/* ==================== Session ==================== */
router.get("/refresh", asyncHandler(controller.refreshHandler));

router.get("/logout", authenticate, asyncHandler(controller.logoutHandler));

/* ==================== Profile ==================== */
router.patch(
  "/change-profile-image",
  authenticate,
  uploadImage("image"),
  asyncHandler(controller.changeProfileImageHandler),
);

/* ==================== OAuth (Google) ==================== */
router.get("/google", controller.googleAuthHandler);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/api/v1/auth/google/error",
  }),
  asyncHandler(controller.googleCallbackHandler),
);

router.get("/google/error", (_req, res) => {
  res.status(401).json({
    success: false,
    error: {
      code: "GOOGLE_AUTH_FAILED",
      message: "Google authentication failed",
    },
  });
});

/* ==================== Admin ==================== */
router.delete(
  "/:id",
  authenticate,
  authorize(Role.ADMIN),
  asyncHandler(controller.deleteUserHandler),
);

export default router;
