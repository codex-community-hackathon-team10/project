import { Router } from "express";
import { z } from "zod";
import type { CoreQueryPort } from "../domain/core-query-port.js";
import { calculateMatchScore, intersectCommonSlots, matchSummary, publicCommonSlots } from "../domain/social.js";
import type { TimeSlot, UserMatchView } from "../domain/types.js";
import { currentUserId } from "./auth.js";
import { ApiError, asyncRoute } from "./errors.js";
import { page } from "./pagination.js";

const queryInput = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).optional() });

type MatchCandidate = {
  view: UserMatchView;
  commonSlots: TimeSlot[];
  score: ReturnType<typeof calculateMatchScore>;
};

export function createMatchRouter(coreQueryPort: CoreQueryPort, clock: () => Date = () => new Date()): Router {
  const router = Router();
  router.get("/matches", asyncRoute(async (request, response) => {
    const query = queryInput.parse(request.query);
    const userId = currentUserId(request);
    const current = await currentMatchView(coreQueryPort, userId);
    const ownSlots = await coreQueryPort.getEffectiveSlots(userId);
    if (ownSlots.length === 0) throw new ApiError(409, "NO_EFFECTIVE_AVAILABILITY", "유효 가능 시간이 없습니다.");

    const candidates = await Promise.all((await coreQueryPort.listDiscoverableCampusUsers(current.campusId, userId)).map(async (candidate) => {
      if (candidate.userId === userId || !candidate.isActive || !candidate.isDiscoverable || candidate.schoolId !== current.schoolId || candidate.campusId !== current.campusId) return null;
      const commonSlots = intersectCommonSlots(ownSlots, await coreQueryPort.getEffectiveSlots(candidate.userId));
      if (!commonSlots.some((slot) => slot.durationMinutes >= Math.max(current.minimumMeetingMinutes, candidate.minimumMeetingMinutes))) return null;
      return { view: candidate, commonSlots, score: calculateMatchScore(current, candidate, commonSlots) } satisfies MatchCandidate;
    }));

    const ranked = candidates.filter((candidate): candidate is MatchCandidate => candidate !== null).toSorted((left, right) => right.score.score - left.score.score || right.score.longestCommonMinutes - left.score.longestCommonMinutes || right.score.commonInterests.length - left.score.commonInterests.length || left.view.userId.localeCompare(right.view.userId));
    const result = page(ranked, query.limit, query.cursor);
    const now = clock();
    const data = result.data.map((candidate) => ({
      userId: candidate.view.userId,
      nickname: candidate.view.nickname,
      grade: candidate.view.grade,
      campus: { id: candidate.view.campusId, name: candidate.view.campusName },
      commonSlots: publicCommonSlots(candidate.commonSlots, now),
      commonActivities: candidate.score.commonActivities,
      commonInterests: candidate.score.commonInterests,
      score: candidate.score.score,
      reasons: candidate.score.reasons,
      summary: matchSummary(candidate.commonSlots, candidate.score),
      summarySource: "TEMPLATE"
    }));

    if (data.length === 0 && !result.meta.hasNext) {
      response.json({ data, meta: { ...result.meta, emptyReason: "NO_MATCHING_USERS", suggestions: ["선호 시간을 넓혀보세요.", "최소 만남 시간을 줄여보세요."], scoreVersion: "v1" } });
      return;
    }
    response.json({ data, meta: { ...result.meta, scoreVersion: "v1" } });
  }));
  return router;
}

async function currentMatchView(coreQueryPort: CoreQueryPort, userId: string): Promise<UserMatchView> {
  try {
    return await coreQueryPort.getUserMatchView(userId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "PROFILE_NOT_FOUND") throw new ApiError(409, "PROFILE_INCOMPLETE", "프로필을 먼저 완성해 주세요.");
    throw error;
  }
}
