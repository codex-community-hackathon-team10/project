import { Router } from "express";
import { z } from "zod";
import { DAYS, type DayOfWeek, type PreferredSlot, type Schedule } from "../domain/types.js";
import { calculateEffectiveSlots, calculateFreeSlots, mergePreferredSlots, parseTime, SERVICE_END, SERVICE_START } from "../domain/time.js";
import { now, type CoreStore } from "../store.js";
import { currentUserId } from "./auth.js";
import { ApiError, asyncRoute } from "./errors.js";

const scheduleInput = z.object({ dayOfWeek: z.enum(DAYS), subjectName: z.string().trim().min(1).max(100), startTime: z.string(), endTime: z.string(), classroom: z.string().trim().max(100).nullable() });
const schedulePatch = scheduleInput.partial();
const availabilityInput = z.object({ preferredSlots: z.array(z.object({ dayOfWeek: z.enum(DAYS), startTime: z.string(), endTime: z.string() })).max(50) });

function validateTimeRange(startTime: string, endTime: string, isWithinServiceWindow: boolean): void {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === null || end === null || start >= end) throw new ApiError(422, "INVALID_TIME_RANGE", "시작 시각은 종료 시각보다 빨라야 합니다.");
  if (start % 30 !== 0 || end % 30 !== 0) throw new ApiError(422, "INVALID_TIME_UNIT", "시각은 30분 단위여야 합니다.");
  if (isWithinServiceWindow && (start < SERVICE_START || end > SERVICE_END)) throw new ApiError(422, "INVALID_TIME_RANGE", "선호 시간은 11:00~15:00 범위여야 합니다.");
}

function hasOverlap(candidate: Pick<Schedule, "dayOfWeek" | "startTime" | "endTime">, schedules: Schedule[]): boolean {
  const candidateStart = parseTime(candidate.startTime)!;
  const candidateEnd = parseTime(candidate.endTime)!;
  return schedules.some((schedule) => schedule.dayOfWeek === candidate.dayOfWeek && candidateStart < parseTime(schedule.endTime)! && parseTime(schedule.startTime)! < candidateEnd);
}

async function availabilityResponse(store: CoreStore, userId: string) {
  const preferredSlots = await store.getAvailability(userId);
  const effectiveSlots = calculateEffectiveSlots(calculateFreeSlots(await store.listSchedules(userId), 30), preferredSlots);
  return { preferredSlots, effectiveSlots, updatedAt: await store.getAvailabilityUpdatedAt(userId) };
}

export function createScheduleRouter(store: CoreStore): Router {
  const router = Router();
  router.get("/me/schedules", asyncRoute(async (request, response) => response.json({ data: await store.listSchedules(currentUserId(request)) })));
  router.post("/me/schedules", asyncRoute(async (request, response) => {
    const userId = currentUserId(request);
    const input = scheduleInput.parse(request.body);
    validateTimeRange(input.startTime, input.endTime, false);
    if (hasOverlap(input, await store.listSchedules(userId))) throw new ApiError(409, "SCHEDULE_TIME_OVERLAP", "같은 요일의 수업 시간이 겹칩니다.");
    const schedule = await store.createSchedule({ ...input, userId });
    response.location(`/api/v1/me/schedules/${schedule.id}`).status(201).json({ data: schedule });
  }));
  router.patch("/me/schedules/:scheduleId", asyncRoute(async (request, response) => {
    const userId = currentUserId(request);
    const current = (await store.listSchedules(userId)).find((schedule) => schedule.id === request.params.scheduleId);
    if (!current) throw new ApiError(404, "SCHEDULE_NOT_FOUND", "수업을 찾을 수 없습니다.");
    const update = schedulePatch.parse(request.body);
    const candidate = { ...current, ...update };
    validateTimeRange(candidate.startTime, candidate.endTime, false);
    if (hasOverlap(candidate, (await store.listSchedules(userId)).filter((schedule) => schedule.id !== current.id))) throw new ApiError(409, "SCHEDULE_TIME_OVERLAP", "같은 요일의 수업 시간이 겹칩니다.");
    response.json({ data: await store.updateSchedule(current.id, update) });
  }));
  router.delete("/me/schedules/:scheduleId", asyncRoute(async (request, response) => {
    const current = (await store.listSchedules(currentUserId(request))).find((schedule) => schedule.id === request.params.scheduleId);
    if (!current) throw new ApiError(404, "SCHEDULE_NOT_FOUND", "수업을 찾을 수 없습니다.");
    await store.deleteSchedule(current.id);
    response.status(204).end();
  }));
  router.get("/me/free-times", asyncRoute(async (request, response) => {
    const rawMinimum = request.query.minimumMinutes ?? "30";
    const minimumMinutes = typeof rawMinimum === "string" ? Number(rawMinimum) : Number.NaN;
    if (!Number.isInteger(minimumMinutes) || minimumMinutes < 30 || minimumMinutes % 30 !== 0) throw new ApiError(422, "VALIDATION_ERROR", "minimumMinutes는 30분 이상의 30분 단위여야 합니다.");
    response.json({ data: { serviceWindow: { startTime: "11:00", endTime: "15:00", timeZone: "Asia/Seoul" }, slots: calculateFreeSlots(await store.listSchedules(currentUserId(request)), minimumMinutes), calculatedAt: now() } });
  }));
  router.get("/me/availability", asyncRoute(async (request, response) => response.json({ data: await availabilityResponse(store, currentUserId(request)) })));
  router.put("/me/availability", asyncRoute(async (request, response) => {
    const userId = currentUserId(request);
    const input = availabilityInput.parse(request.body);
    input.preferredSlots.forEach((slot) => validateTimeRange(slot.startTime, slot.endTime, true));
    const slots: PreferredSlot[] = mergePreferredSlots(input.preferredSlots);
    await store.saveAvailability(userId, slots);
    response.json({ data: await availabilityResponse(store, userId) });
  }));
  return router;
}
