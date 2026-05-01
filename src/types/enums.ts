export enum Role {
  USER = "user",
  PROVIDER = "provider",
  ADMIN = "admin",
}

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

export enum QueueEntryStatus {
  WAITING = "waiting",
  NOTIFIED = "notified",
  CONFIRMED = "confirmed",
  EXPIRED = "expired",
  LEFT = "left",
}

export enum SlotStatus {
  AVAILABLE = "available",
  FULL = "full",
  CLOSED = "closed",
}
