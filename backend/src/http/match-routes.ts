import { Router } from "express";
import { z } from "zod";
import type { CoreQueryPort } from "../domain/core-query-port.js";
import { matchSummary, publicCommonSlots } from "../domain/social.js";
import { currentUserId } from "./auth.js";
import { asyncRoute } from "./errors.js";
import { listEligibleMatchCandidates } from "../match-candidates.js";
import { page } from "./pagination.js";

const queryInput = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).optional() });

export function createMatchRouter(coreQueryPort: CoreQueryPort, clock: () => Date = () => new Date()): Router {
  const router = Router();
  router.get("/matches", asyncRoute(async (request, response) => {
    const query = queryInput.parse(request.query);
    const userId = currentUserId(request);
    const ranked = await listEligibleMatchCandidates(coreQueryPort, userId);
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
