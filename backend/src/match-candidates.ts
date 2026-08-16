import type { CoreQueryPort } from "./domain/core-query-port.js";
import { calculateMatchScore, intersectCommonSlots, type CommonSlot, type MatchScore } from "./domain/social.js";
import type { UserMatchView } from "./domain/types.js";
import { ApiError } from "./http/errors.js";

export type MatchCandidate = { view: UserMatchView; commonSlots: CommonSlot[]; score: MatchScore };

export async function listEligibleMatchCandidates(coreQueryPort: CoreQueryPort, userId: string): Promise<MatchCandidate[]> {
  const current = await currentMatchView(coreQueryPort, userId);
  const ownSlots = await coreQueryPort.getEffectiveSlots(userId);
  if (ownSlots.length === 0) throw new ApiError(409, "NO_EFFECTIVE_AVAILABILITY", "유효 가능 시간이 없습니다.");

  const candidates = await Promise.all((await coreQueryPort.listDiscoverableCampusUsers(current.campusId, userId)).map(async (candidate) => {
    if (candidate.userId === userId || !candidate.isActive || !candidate.isDiscoverable || candidate.schoolId !== current.schoolId || candidate.campusId !== current.campusId) return null;
    const commonSlots = intersectCommonSlots(ownSlots, await coreQueryPort.getEffectiveSlots(candidate.userId));
    if (!commonSlots.some((slot) => slot.durationMinutes >= Math.max(current.minimumMeetingMinutes, candidate.minimumMeetingMinutes))) return null;
    return { view: candidate, commonSlots, score: calculateMatchScore(current, candidate, commonSlots) } satisfies MatchCandidate;
  }));

  return candidates.filter((candidate): candidate is MatchCandidate => candidate !== null).toSorted((left, right) => right.score.score - left.score.score || right.score.longestCommonMinutes - left.score.longestCommonMinutes || right.score.commonInterests.length - left.score.commonInterests.length || left.view.userId.localeCompare(right.view.userId));
}

async function currentMatchView(coreQueryPort: CoreQueryPort, userId: string): Promise<UserMatchView> {
  try {
    return await coreQueryPort.getUserMatchView(userId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "PROFILE_NOT_FOUND") throw new ApiError(409, "PROFILE_INCOMPLETE", "프로필을 먼저 완성해 주세요.");
    throw error;
  }
}
