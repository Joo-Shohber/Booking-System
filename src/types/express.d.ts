import { Role } from "./enums";

export interface JwtPayload {
  userId: string;
  role: Role;
  jti: string;
}

declare global {
  namespace Express {
    interface User {
      userId: string;
      role: Role;
      jti: string;
    }

    interface Request {
      user: User; // required — بدون ?
      requestId: string;
    }
  }
}

// override نهائي يمنع Passport من إنه يعمل user optional
declare module "express-serve-static-core" {
  interface Request {
    user: Express.User; // required — بيـoverride تعريف Passport
    requestId: string;
  }
}
