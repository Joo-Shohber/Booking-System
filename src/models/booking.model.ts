import mongoose, { Document, Schema, Types } from "mongoose";
import { BookingStatus } from "../types/enums";

export interface IBooking extends Document {
  slotId: Types.ObjectId;
  userId: Types.ObjectId;
  status: BookingStatus;
  expiresAt: Date;
  notes?: string;
  confirmedAt?: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    slotId: {
      type: Schema.Types.ObjectId,
      ref: "Slot",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
    },
    confirmedAt: { type: Date },
  },
  { timestamps: true },
);

bookingSchema.index({ slotId: 1, userId: 1 }, { unique: true });
bookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ slotId: 1, status: 1 });

export const Booking = mongoose.model<IBooking>("Booking", bookingSchema);
