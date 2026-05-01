import jwt from "jsonwebtoken";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import getRedis from "../../config/redis";
import getEnv from "../../config/env";
import { AppError } from "../../types/errors";
import { Role } from "../../types/enums";
import { REDIS_KEYS } from "../../services/cache.service";

interface AccessTokenPayload {
  userId: string;
  role: Role;
}

export function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return value;
  }
}

async function scanKeys(pattern: string): Promise<string[]> {
  const redis = getRedis();
  let cursor = "0";
  const keys: string[] = [];

  do {
    const [nextCursor, found] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    keys.push(...found);
  } while (cursor !== "0");
  return keys;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  const env = getEnv();
  const jti = uuidv4();
  return jwt.sign(
    { userId: payload.userId, role: payload.role, jti },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const env = getEnv();
  const redis = getRedis();
  const jti = uuidv4();

  const token = jwt.sign({ userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const ttl = parseDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN);
  await redis.setex(REDIS_KEYS.refreshToken(userId, jti), ttl, hash);
  return token;
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const keys = await scanKeys(REDIS_KEYS.allRefreshTokens(userId));
  if (keys.length > 0) {
    const redis = getRedis();
    await redis.del(...keys);
  }
}

export async function rotateRefreshToken(
  oldToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const env = getEnv();
  const redis = getRedis();

  let decoded: { userId: string; jti: string; role?: Role };
  try {
    decoded = jwt.verify(oldToken, env.JWT_REFRESH_SECRET) as {
      userId: string;
      jti: string;
      role?: Role;
    };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError("TOKEN_EXPIRED", 401, "Refresh token expired");
    }
    throw new AppError("INVALID_TOKEN", 401, "Invalid refresh token");
  }

  const { userId, jti } = decoded;
  const storedHash = await redis.get(REDIS_KEYS.refreshToken(userId, jti));

  if (!storedHash) {
    await revokeAllUserTokens(userId);
    throw new AppError(
      "REFRESH_TOKEN_REUSE",
      401,
      "Refresh token reuse detected",
    );
  }

  const incomingHash = crypto
    .createHash("sha256")
    .update(oldToken)
    .digest("hex");
  if (incomingHash !== storedHash) {
    await revokeAllUserTokens(userId);
    throw new AppError(
      "REFRESH_TOKEN_REUSE",
      401,
      "Refresh token reuse detected",
    );
  }

  await redis.del(REDIS_KEYS.refreshToken(userId, jti));

  const { User } = await import("../../models/user.model");
  const user = await User.findById(userId);
  const role = user?.role ?? Role.USER;

  const accessToken = generateAccessToken({ userId, role });
  const refreshToken = await generateRefreshToken(userId);

  return { accessToken, refreshToken };
}
