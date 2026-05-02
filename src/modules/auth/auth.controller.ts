import { Request, RequestHandler, Response } from "express";
import * as authService from "./auth.service";
import getEnv from "../../config/env";
import passport from "passport";
import { JwtPayload } from "../../types/express";

function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const value = parseInt(match[1], 10);

  switch (match[2]) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 1000;
  }
}

const REFRESH_TOKEN_COOKIE = "refreshToken";

function setRefreshTokenCookie(res: Response, token: string): void {
  const env = getEnv();

  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
    path: "/api/v1/auth",
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
  });
}

// =========================
// REGISTER
// =========================
export async function registerHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    data: result,
  });
}

// =========================
// VERIFY EMAIL
// =========================
export async function verifyEmailHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { email, otp } = req.body;

  const result = await authService.verifyEmail(email, otp);

  setRefreshTokenCookie(res, result.tokens.refreshToken);

  res.status(200).json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
    },
  });
}

// =========================
// RESEND OTP
// =========================
export async function resendOtpHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { email } = req.body;

  const result = await authService.resendOtp(email);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// =========================
// LOGIN
// =========================
export async function loginHandler(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);

  setRefreshTokenCookie(res, result.tokens.refreshToken);

  res.status(200).json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
    },
  });
}

// =========================
// Forget Password
// =========================
export async function forgetPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { email } = req.body;

  await authService.forgetPassword(email);

  res.status(200).json({
    success: true,
    message: "If email exists, OTP sent",
  });
}

// =========================
// RESET PASSWORD
// =========================
export async function resetPasswordHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { email, otp, newPassword } = req.body;

  const result = await authService.resetPassword(email, otp, newPassword);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// =========================
// REFRESH TOKEN
// =========================
export async function refreshHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

  if (!refreshToken) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "No refresh token provided",
      },
    });
    return;
  }

  const result = await authService.refreshTokens(refreshToken);

  setRefreshTokenCookie(res, result.refreshToken);

  res.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
    },
  });
}

// =========================
// LOGOUT (COOKIE CLEAR)
// =========================
export async function logoutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  clearRefreshTokenCookie(res);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

// =========================
// DELETE USER (ADMIN)
// =========================
export async function deleteUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await authService.deleteUser(req.params.id);
  res.status(200).json({ success: true, data: result });
}

// PATCH /change-profile-image
export async function changeProfileImageHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = req.user.userId;
  if (!userId) return;

  if (!req.file) {
    res.status(422).json({
      success: false,
      error: { code: "NO_FILE", message: "No image uploaded" },
    });
    return;
  }

  const result = await authService.changeProfileImage(userId, req.file.buffer);
  res.status(200).json({ success: true, data: result });
}

// GET /google
export const googleAuthHandler = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

// GET /google/callback
export async function googleCallbackHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const env = getEnv();
  try {
    const user = req.user as JwtPayload;
    const result = await authService.googleLogin(user);
    setRefreshTokenCookie(res, result.tokens.refreshToken);
    res.redirect(
      `${env.CLIENT_URL}/auth/google/success?token=${result.tokens.accessToken}`,
    );
  } catch {
    res.redirect(`${env.CLIENT_URL}/auth/google/error`);
  }
}
