import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { AppError } from "../types/errors";
import { logger } from "../config/logger";
import getEnv from "../config/env";

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const env = getEnv();
  const isProd = env.NODE_ENV === "production";

  logger.error(
    { Error: err, requestId: req.requestId, path: req.path },
    "Request error",
  );

  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred";
  let details: unknown;

  if (err instanceof AppError && err.isOperational) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } 

  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = "INVALID_ID";
    message = `Invalid value for field: ${err.path}`;
  } 

  else if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  ) {
    const mongoErr = err as { keyValue?: Record<string, unknown> };
    statusCode = 409;
    code = "DUPLICATE_KEY";
    const field = mongoErr.keyValue
      ? Object.keys(mongoErr.keyValue)[0]
      : "unknown";
    message = `Duplicate value for field: ${field}`;
    details = mongoErr.keyValue;
  } 

  else if (err instanceof jwt.JsonWebTokenError) {
    statusCode = 401;
    code = "INVALID_TOKEN";
    message = "Invalid token";
  } 

  else if (err instanceof jwt.TokenExpiredError) {
    statusCode = 401;
    code = "TOKEN_EXPIRED";
    message = "Token has expired";
  } 

  else if (!isProd && err instanceof Error) {
    message = err.message;
  }

  const body: ErrorResponse = {
    success: false,
    error: { code, message },
  };

  if (details !== undefined) {
    body.error.details = details;
  }

  res.status(statusCode).json(body);
}
