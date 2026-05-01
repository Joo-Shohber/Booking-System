import mongoose, { Document, Schema, Types } from "mongoose";
import { SlotStatus } from "../types/enums";

export interface ISlot extends Document {
  providerId: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  capacity: number;
  booked: number;
  date: Date;
  isActive: boolean;
  available: number;
  isFull: boolean;
  status: SlotStatus;
}

const slotSchema = new Schema<ISlot>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    booked: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

slotSchema.index({ providerId: 1, startTime: 1 }, { unique: true });
slotSchema.index({ providerId: 1, date: 1 });

slotSchema.virtual("available").get(function (this: ISlot): number {
  return this.capacity - this.booked;
});

slotSchema.virtual("isFull").get(function (this: ISlot): boolean {
  return this.booked >= this.capacity;
});

slotSchema.virtual("status").get(function (this: ISlot): SlotStatus {
  if (!this.isActive) return SlotStatus.CLOSED;
  if (this.booked >= this.capacity) return SlotStatus.FULL;
  return SlotStatus.AVAILABLE;
});

export const Slot = mongoose.model<ISlot>("Slot", slotSchema);
