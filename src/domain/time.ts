import type { DayOfWeek, PreferredSlot, Schedule, TimeSlot } from "./types.js";

export const SERVICE_START = 11 * 60;
export const SERVICE_END = 15 * 60;

type Interval = { start: number; end: number };

export function parseTime(value: string): number | null {
  const matched = /^(?:[01]\\d|2[0-3]):[0-5]\\d$/.exec(value);
  if (!matched) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  return intervals.toSorted((a, b) => a.start - b.start).reduce<Interval[]>((merged, current) => {
    const previous = merged.at(-1);
    if (!previous || previous.end < current.start) return [...merged, { ...current }];
    return [...merged.slice(0, -1), { start: previous.start, end: Math.max(previous.end, current.end) }];
  }, []);
}

function slotsFromIntervals(dayOfWeek: DayOfWeek, intervals: Interval[]): TimeSlot[] {
  return intervals.map(({ start, end }) => ({ dayOfWeek, startTime: formatTime(start), endTime: formatTime(end), durationMinutes: end - start }));
}

export function calculateFreeSlots(schedules: Schedule[], minimumMinutes: number): TimeSlot[] {
  const days: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  return days.flatMap((dayOfWeek) => {
    const busy = mergeIntervals(schedules.filter((schedule) => schedule.dayOfWeek === dayOfWeek).map((schedule) => ({ start: Math.max(parseTime(schedule.startTime)!, SERVICE_START), end: Math.min(parseTime(schedule.endTime)!, SERVICE_END) })).filter(({ start, end }) => start < end));
    const result: Interval[] = [];
    let cursor = SERVICE_START;
    for (const interval of busy) {
      if (cursor < interval.start) result.push({ start: cursor, end: interval.start });
      cursor = Math.max(cursor, interval.end);
    }
    if (cursor < SERVICE_END) result.push({ start: cursor, end: SERVICE_END });
    return slotsFromIntervals(dayOfWeek, result.filter((slot) => slot.end - slot.start >= minimumMinutes));
  });
}

export function mergePreferredSlots(slots: PreferredSlot[]): PreferredSlot[] {
  const days: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  return days.flatMap((dayOfWeek) => mergeIntervals(slots.filter((slot) => slot.dayOfWeek === dayOfWeek).map((slot) => ({ start: parseTime(slot.startTime)!, end: parseTime(slot.endTime)! }))).map(({ start, end }) => ({ dayOfWeek, startTime: formatTime(start), endTime: formatTime(end) })));
}

export function calculateEffectiveSlots(freeSlots: TimeSlot[], preferredSlots: PreferredSlot[]): TimeSlot[] {
  return preferredSlots.flatMap((preferred) => freeSlots.filter((free) => free.dayOfWeek === preferred.dayOfWeek).flatMap((free) => {
    const start = Math.max(parseTime(free.startTime)!, parseTime(preferred.startTime)!);
    const end = Math.min(parseTime(free.endTime)!, parseTime(preferred.endTime)!);
    return start < end ? [{ dayOfWeek: free.dayOfWeek, startTime: formatTime(start), endTime: formatTime(end), durationMinutes: end - start }] : [];
  }));
}
