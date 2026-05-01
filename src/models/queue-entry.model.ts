import mongoose, { Document, Schema, Types } from "mongoose";
import { QueueEntryStatus } from "../types/enums";

export interface IQueueEntry extends Document {
  slotId: Types.ObjectId;
  userId: Types.ObjectId;
  joinedAt: Date;
  status: QueueEntryStatus;
  notifiedAt?: Date;
  confirmationDeadline?: Date;
  estimatedWait: number;
}

const queueEntrySchema = new Schema<IQueueEntry>(
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
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: Object.values(QueueEntryStatus),
      default: QueueEntryStatus.WAITING,
    },
    notifiedAt: { type: Date },
    confirmationDeadline: { type: Date },
    estimatedWait: { type: Number, min: 0 },
  },
  { timestamps: true },
);

queueEntrySchema.index({ slotId: 1, userId: 1 }, { unique: true });
queueEntrySchema.index({ slotId: 1, status: 1, joinedAt: 1 });

export const QueueEntry = mongoose.model<IQueueEntry>(
  "QueueEntry",
  queueEntrySchema,
);
