import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import getEnv from "../config/env";
import { AppError } from "../types/errors";
import { JwtPayload } from "../types/express";

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", 401, "No token provided");
  }

  const token = authHeader.split(" ")[1];
  const env = getEnv();

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError("TOKEN_EXPIRED", 401, "Token has expired"));
    }

    return next(new AppError("INVALID_TOKEN", 401, "Invalid token"));
  }
}
