import crypto from "crypto";
import getRedis from "../config/redis";
import getEnv from "../config/env";
import { AppError } from "../types/errors";

function generateOTP(): string {
  const env = getEnv();
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < env.OTP_LENGTH; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

function hashOTP(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function createOTP(key: string) {
  const redis = getRedis();
  const env = getEnv();

  const otp = generateOTP();
  const hashedOtp = hashOTP(otp);
  const ttl = Number(env.OTP_EXPIRES_MINUTES * 60);

  await redis.setex(key, ttl, hashedOtp);

  return otp;
}

export async function verifyOTP(key: string, otp: string) {
  const redis = getRedis();
  const storedHashOtp = await redis.get(key);

  if (!storedHashOtp) {
    throw new AppError("OTP_EXPIRED", 400, "OTP expired or not found");
  }

  const hashed = hashOTP(otp);

  if (hashed !== storedHashOtp) {
    throw new AppError("INVALID_OTP", 400, "Invalid OTP");
  }

  await redis.del(key);
  return true;
}
