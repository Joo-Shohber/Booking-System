import { Request, Response, NextFunction, RequestHandler } from "express";
import { Role } from "../types/enums";
import { AppError } from "../types/errors";

export function authorize(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError("FORBIDDEN", 403, "Insufficient permissions");
    }
    next();
  };
}
