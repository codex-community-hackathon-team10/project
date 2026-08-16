import { describe, expect, it } from "vitest";
import { calculateFreeSlots } from "../src/domain/time.js";
import type { Schedule } from "../src/domain/types.js";

const schedule = (dayOfWeek: Schedule["dayOfWeek"], startTime: string, endTime: string): Schedule => ({ id: `${dayOfWeek}-${startTime}`, userId: "user_a", dayOfWeek, startTime, endTime, subjectName: "수업", classroom: null, createdAt: "", updatedAt: "" });

describe("calculateFreeSlots", () => {
  it.each([
    [[], ["11:00-15:00"]],
    [[schedule("MONDAY", "10:00", "12:00"), schedule("MONDAY", "14:00", "16:00")], ["12:00-14:00"]],
    [[schedule("MONDAY", "11:00", "15:00")], []],
    [[schedule("MONDAY", "12:00", "13:00"), schedule("MONDAY", "13:00", "14:00")], ["11:00-12:00", "14:00-15:00"]]
  ] as const)("calculates free slots for schedules", (schedules, expected) => {
    const slots = calculateFreeSlots([...schedules], 30).filter((slot) => slot.dayOfWeek === "MONDAY").map((slot) => `${slot.startTime}-${slot.endTime}`);
    expect(slots).toEqual(expected);
  });
});
