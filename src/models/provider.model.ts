import mongoose, { Document, Schema, Types } from "mongoose";

export interface WorkingHour {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  start: string;
  end: string;
}

export interface IProvider extends Document {
  userId: Types.ObjectId;
  name: string;
  service: string;
  workingHours: WorkingHour[];
  slotDuration: number;
  capacity: number;
  isActive: boolean;
}

const workingHourSchema = new Schema<WorkingHour>(
  {
    day: {
      type: String,
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      required: true,
    },
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const providerSchema = new Schema<IProvider>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    service: {
      type: String,
      required: true,
      trim: true,
    },
    workingHours: {
      type: [workingHourSchema],
      required: true,
    },
    slotDuration: {
      type: Number,
      default: 30,
      min: 5,
      max: 480,
    },
    capacity: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const Provider = mongoose.model<IProvider>("Provider", providerSchema);
