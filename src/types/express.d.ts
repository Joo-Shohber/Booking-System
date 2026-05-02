import { Role } from "./enums";

export interface JwtPayload {
  userId: string;
  role: Role;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      user: User;
      requestId: string;
    }

    interface User {
      _id: import("mongoose").Types.ObjectId;
      name: string;
      email: string;
      role: Role;
      googleId?: string;
      isEmailVerified?: boolean;
    }
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user: Express.User;
    requestId: string;
  }
}
