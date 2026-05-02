import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcrypt";
import { Role } from "../types/enums";
import getEnv from "../config/env";

export interface IProfilePhoto {
  url: string;
  publicId: string | null;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: Role;
  refreshTokenFamily: string[];
  isEmailVerified: boolean;
  googleId?: string;
  profilePhoto: IProfilePhoto;
  emailOtp?: string;
  emailOtpExpiresAt?: Date;
  passwordResetOtp?: string;
  passwordResetOtpExpiresAt?: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.USER,
    },
    refreshTokenFamily: {
      type: [String],
      default: [],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    googleId: { type: String, select: false },
    profilePhoto: {
      type: Object,
      default: {
        url: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460__480.png",
        publicId: null,
      },
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { sparse: true }); // sparse — Google users only

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const env = getEnv();
  this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);
