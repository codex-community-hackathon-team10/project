import { Router } from "express";
import { z } from "zod";
import { inspectMeetingDateTime, rankVenues, venueRecommendationReason, type MeetingTimeInspection } from "../domain/social.js";
import { ATMOSPHERES, PRICE_RANGES } from "../domain/types.js";
import type { SocialStore } from "../store.js";
import { ApiError, asyncRoute } from "./errors.js";

const queryInput = z.object({
  campusId: z.string().min(1),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  activity: z.string(),
  budget: z.enum(PRICE_RANGES).optional(),
  atmosphere: z.enum(ATMOSPHERES).optional()
});

export function createVenueRouter(store: SocialStore, clock: () => Date = () => new Date()): Router {
  const router = Router();
  router.get("/venues/recommendations", asyncRoute(async (request, response) => {
    const query = queryInput.parse(request.query);
    if (!await store.getCampus(query.campusId)) throw new ApiError(404, "CAMPUS_NOT_FOUND", "캠퍼스를 찾을 수 없습니다.");
    if (query.activity !== "LUNCH") throw new ApiError(422, "UNSUPPORTED_ACTIVITY", "P0에서는 점심 만남만 지원합니다.");
    const inspected = inspectMeetingDateTime(query.date, query.startTime, query.endTime, clock());
    if (!inspected.ok) throw venueTimeError(inspected.code);
    const durationMinutes = (new Date(`${query.date}T${query.endTime}:00+09:00`).getTime() - inspected.startAt.getTime()) / 60_000;
    const venues = rankVenues(await store.listActiveVenues(query.campusId), durationMinutes, query.budget, query.atmosphere).slice(0, 3).map(({ venue }) => ({
      id: venue.id,
      campusId: venue.campusId,
      name: venue.name,
      category: venue.category,
      walkMinutes: venue.walkMinutes,
      priceRange: venue.priceRange,
      tags: venue.tags,
      description: venue.description,
      recommendationReason: venueRecommendationReason(venue, durationMinutes),
      reasonSource: "TEMPLATE"
    }));
    if (venues.length === 0) {
      response.json({ data: [], meta: { limit: 3, emptyReason: "NO_VENUE_CANDIDATES", allowCustomVenue: true, isRealTimeAvailabilityGuaranteed: false } });
      return;
    }
    response.json({ data: venues, meta: { limit: 3, isRealTimeAvailabilityGuaranteed: false } });
  }));
  return router;
}

function venueTimeError(code: Extract<MeetingTimeInspection, { ok: false }>["code"]): ApiError {
  if (code === "DATE_WEEKDAY_MISMATCH") return new ApiError(422, "DATE_WEEKDAY_MISMATCH", "평일 날짜를 선택해 주세요.");
  if (code === "INVALID_TIME_UNIT") return new ApiError(422, "INVALID_TIME_UNIT", "시각은 30분 단위여야 합니다.");
  return new ApiError(422, "INVALID_TIME_RANGE", "미래의 올바른 시간 범위를 선택해 주세요.");
}
