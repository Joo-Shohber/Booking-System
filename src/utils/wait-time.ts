export function calculateWaitTime(
  position: number,
  slotDurationMinutes: number,
): number {
  return position * slotDurationMinutes;
}
