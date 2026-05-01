import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../types/errors";

export function validate(
  schema: ZodSchema,
  target: "body" | "query" | "params" = "body",
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      throw new AppError("VALIDATION_ERROR", 422, "Validation failed", details);
    }
    req[target] = result.data;
    next();
  };
}
