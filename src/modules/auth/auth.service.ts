import { User } from "../../models/user.model";
import { AppError } from "../../types/errors";

import {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
} from "./token.service";

import { createOTP, verifyOTP } from "../../services/otp.service";
import { emailService } from "../../services/email.service";
import getEnv from "../../config/env";
import getRedis from "../../config/redis";
import { REDIS_KEYS } from "../../services/cache.service";
import { RegisterDtoType, LoginDtoType } from "./auth.schema";

// ==========================
// REGISTER
// ==========================
export async function register(dto: RegisterDtoType) {
  const existing = await User.findOne({ email: dto.email });

  if (existing) {
    throw new AppError("VALIDATION_ERROR", 422, "Email already in use");
  }

  const user = await User.create({
    name: dto.name,
    email: dto.email,
    password: dto.password,
    role: dto.role,
  });

  const otp = await createOTP(REDIS_KEYS.otpEmailVerify(user.email));

  await emailService.send(user.email, "email_verification_otp", {
    otp,
    expiresInMinutes: getEnv().OTP_EXPIRES_MINUTES,
  });

  return {
    message: "Verification OTP sent to email",
  };
}

// ==========================
// VERIFY EMAIL
// ==========================
export async function verifyEmail(email: string, otp: string) {
  await verifyOTP(REDIS_KEYS.otpEmailVerify(email), otp);

  const user = await User.findOneAndUpdate(
    { email },
    { isEmailVerified: true },
    { new: true },
  );

  if (!user) {
    throw new AppError("NOT_FOUND", 404, "User not found");
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refreshToken = await generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: true,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

// ==========================
// RESEND OTP
// ==========================
export async function resendOtp(email: string) {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("NOT_FOUND", 404, "User not found");
  }

  if (user.isEmailVerified) {
    throw new AppError("BAD_REQUEST", 400, "Email already verified");
  }

  const otp = await createOTP(REDIS_KEYS.otpEmailVerify(user.email));

  await emailService.send(email, "email_verification_otp", {
    otp,
    expiresInMinutes: getEnv().OTP_EXPIRES_MINUTES,
  });

  return { message: "OTP resent successfully" };
}

// ==========================
// LOGIN
// ==========================
export async function login(dto: LoginDtoType) {
  const user = await User.findOne({ email: dto.email }).select("+password");

  if (!user) {
    throw new AppError("UNAUTHORIZED", 401, "Invalid credentials");
  }

  if (!user.isEmailVerified) {
    throw new AppError(
      "EMAIL_NOT_VERIFIED",
      403,
      "Please verify your email first",
    );
  }

  const isValid = await user.comparePassword(dto.password);

  if (!isValid) {
    throw new AppError("UNAUTHORIZED", 401, "Invalid credentials");
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
  });

  const refreshToken = await generateRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

// ==========================
// Forget Password
// ==========================
export async function forgetPassword(email: string) {
  const user = await User.findOne({ email });

  if (!user) return;

  const otp = await createOTP(REDIS_KEYS.otpPasswordReset(email));

  await emailService.send(email, "password_reset_otp", {
    otp,
    expiresInMinutes: getEnv().OTP_EXPIRES_MINUTES,
  });
}

// ==========================
// RESET PASSWORD
// ==========================
export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
) {
  await verifyOTP(REDIS_KEYS.otpEmailVerify(email), otp);

  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("NOT_FOUND", 404, "User not found");
  }

  user.password = newPassword;
  await user.save();

  await revokeAllUserTokens(user.id);

  return {
    message: "Password reset successful",
  };
}

// ==========================
// REFRESH TOKEN
// ==========================
export async function refreshTokens(refreshToken: string) {
  return rotateRefreshToken(refreshToken);
}

// ==========================
// LOGOUT
// ==========================
export async function logout(refreshToken: string) {
  try {
    const jwt = require("jsonwebtoken");

    const decoded = jwt.decode(refreshToken) as {
      userId?: string;
      jti?: string;
    } | null;

    if (decoded?.userId && decoded?.jti) {
      const redis = getRedis();

      await redis.del(`rt:${decoded.userId}:${decoded.jti}`);
    }
  } catch {
    // Do Nothing - silent fail
  }
}

// ==========================
// DELETE USER (ADMIN)
// ==========================
export async function deleteUser(targetUserId: string) {
  const user = await User.findById(targetUserId);
  if (!user) throw new AppError("NOT_FOUND", 404, "User not found");

  await revokeAllUserTokens(targetUserId);

  await User.findByIdAndDelete(targetUserId);

  return { message: "User deleted successfully." };
}
