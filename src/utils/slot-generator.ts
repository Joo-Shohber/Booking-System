import { IProvider } from "../models/provider.model";

const DAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface SlotObject {
  providerId: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  date: Date;
  isActive: boolean;
}

export function generateSlots(
  provider: IProvider,
  startDate: Date,
  endDate: Date,
): SlotObject[] {
  const slots: SlotObject[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      current.getDay()
    ];
    const workingDay = provider.workingHours.find((wh) => wh.day === dayName);

    if (workingDay) {
      const [startHour, startMin] = workingDay.start.split(":").map(Number);
      const [endHour, endMin] = workingDay.end.split(":").map(Number);

      const dayStart = new Date(current);
      dayStart.setHours(startHour, startMin, 0, 0);

      const dayEnd = new Date(current);
      dayEnd.setHours(endHour, endMin, 0, 0);

      const slotMs = provider.slotDuration * 60 * 1000;
      let slotStart = new Date(dayStart);

      while (new Date(slotStart.getTime() + slotMs) <= dayEnd) {
        const slotEnd = new Date(slotStart.getTime() + slotMs);
        slots.push({
          providerId: provider._id.toString(),
          startTime: new Date(slotStart),
          endTime: slotEnd,
          capacity: provider.capacity,
          date: new Date(current),
          isActive: true,
        });
        slotStart = slotEnd;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return slots;
}
