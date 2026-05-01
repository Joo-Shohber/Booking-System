import { z } from "zod";
import { Role } from "../../types/enums";

export const RegisterDto = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(Role).optional().default(Role.USER),
});

export const LoginDto = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const VerifyEmailDto = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const resendOtpDto = z.object({
  email: z.string().email(),
});

export const forgetPasswordDto = z.object({
  email: z.string().email(),
});

export const ResetPasswordDto = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type LoginDtoType = z.infer<typeof LoginDto>;
