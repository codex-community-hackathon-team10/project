import { parseTime } from "./time.js";
import { DAYS, type DayOfWeek, type MeetingProposal, type ProposalStatus, type TimeSlot, type UserMatchView, type Venue } from "./types.js";

export type CommonSlot = TimeSlot;
export type MatchReason = { type: "COMMON_TIME" | "COMMON_ACTIVITY" | "COMMON_INTEREST" | "LANGUAGE_EXCHANGE"; label: string; score: number };
export type MatchScore = {
  score: number;
  longestCommonMinutes: number;
  commonActivities: string[];
  commonInterests: string[];
  reasons: MatchReason[];
};
export type RankedVenue = { venue: Venue; score: number };
export type MeetingTimeInspection =
  | { ok: true; dayOfWeek: DayOfWeek; startAt: Date }
  | { ok: false; code: "INVALID_DATE" | "DATE_WEEKDAY_MISMATCH" | "INVALID_TIME_RANGE" | "INVALID_TIME_UNIT" | "NOT_FUTURE" };
export type ProposalTransitionValidation = { allowed: true } | { allowed: false; code: "PROPOSAL_STATUS_CHANGE_FORBIDDEN" | "PROPOSAL_STATUS_CONFLICT" | "PROPOSAL_ALREADY_STARTED" };

const dayRank = (day: DayOfWeek): number => DAYS.indexOf(day);

function orderedIntersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return [...new Set(left.filter((item) => rightSet.has(item)))].sort();
}

export function isTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const parsed = [startA, endA, startB, endB].map(parseTime);
  if (parsed.some((value) => value === null)) return false;
  const [parsedStartA, parsedEndA, parsedStartB, parsedEndB] = parsed as number[];
  return parsedStartA < parsedEndB && parsedStartB < parsedEndA;
}

export function intersectCommonSlots(left: TimeSlot[], right: TimeSlot[]): CommonSlot[] {
  const raw = left.flatMap((leftSlot) => right.flatMap((rightSlot) => {
    if (leftSlot.dayOfWeek !== rightSlot.dayOfWeek) return [];
    const start = Math.max(parseTime(leftSlot.startTime)!, parseTime(rightSlot.startTime)!);
    const end = Math.min(parseTime(leftSlot.endTime)!, parseTime(rightSlot.endTime)!);
    return start < end ? [{ dayOfWeek: leftSlot.dayOfWeek, start, end }] : [];
  }));

  return DAYS.flatMap((dayOfWeek) => raw.filter((slot) => slot.dayOfWeek === dayOfWeek).toSorted((a, b) => a.start - b.start).reduce<{ dayOfWeek: DayOfWeek; start: number; end: number }[]>((merged, slot) => {
    const previous = merged.at(-1);
    if (!previous || previous.end < slot.start) return [...merged, slot];
    return [...merged.slice(0, -1), { ...previous, end: Math.max(previous.end, slot.end) }];
  }, []).map((slot) => ({
    dayOfWeek,
    startTime: formatTime(slot.start),
    endTime: formatTime(slot.end),
    durationMinutes: slot.end - slot.start
  })));
}

export function calculateMatchScore(current: UserMatchView, candidate: UserMatchView, commonSlots: CommonSlot[]): MatchScore {
  const longestCommonMinutes = Math.max(0, ...commonSlots.map((slot) => slot.durationMinutes));
  const commonActivities = orderedIntersection(current.activities, candidate.activities);
  const commonInterests = orderedIntersection(current.interests, candidate.interests);
  const reasons: MatchReason[] = [];
  const timeScore = Math.min(60, Math.floor(longestCommonMinutes / 30) * 10);
  if (timeScore > 0) reasons.push({ type: "COMMON_TIME", label: `공통 가능 시간 ${longestCommonMinutes}분`, score: timeScore });

  const lunchMatched = commonActivities.includes("LUNCH");
  const otherActivities = commonActivities.filter((activity) => activity !== "LUNCH");
  const activityScore = (lunchMatched ? 20 : 0) + Math.min(15, otherActivities.length * 5);
  if (activityScore > 0) {
    const label = lunchMatched && otherActivities.length > 0 ? `점심·공통 활동 ${otherActivities.length}개 일치` : lunchMatched ? "점심 활동 일치" : `공통 활동 ${otherActivities.length}개 일치`;
    reasons.push({ type: "COMMON_ACTIVITY", label, score: activityScore });
  }

  const interestScore = Math.min(15, commonInterests.length * 3);
  if (interestScore > 0) reasons.push({ type: "COMMON_INTEREST", label: `관심사 ${commonInterests.length}개 일치`, score: interestScore });

  if (hasMutualLanguageExchange(current, candidate)) reasons.push({ type: "LANGUAGE_EXCHANGE", label: "언어교환 조건 상호 일치", score: 10 });

  return { score: reasons.reduce((total, reason) => total + reason.score, 0), longestCommonMinutes, commonActivities, commonInterests, reasons };
}

export function rankVenues(venues: Venue[], durationMinutes: number, budget?: string, atmosphere?: string): RankedVenue[] {
  return venues.map((venue) => {
    let score = venue.category === "RESTAURANT" ? 30 : 0;
    if (durationMinutes <= 60) {
      if (venue.walkMinutes <= 5) score += 20;
      if (venue.tags.includes("QUICK_MEAL")) score += 25;
    }
    if (durationMinutes >= 90) {
      if (venue.tags.includes("GOOD_FOR_TALKING")) score += 15;
      if (venue.tags.includes("RELAXED")) score += 15;
    }
    if (budget && budget !== "FLEXIBLE" && venue.priceRange === budget) score += 10;
    if (atmosphere && venue.tags.includes(atmosphere)) score += 10;
    return { venue, score };
  }).toSorted((left, right) => right.score - left.score || left.venue.walkMinutes - right.venue.walkMinutes || left.venue.id.localeCompare(right.venue.id));
}

export function countDailyProposalRecipients(proposals: MeetingProposal[], senderId: string, date: string): number {
  return new Set(proposals.filter((proposal) => proposal.senderId === senderId && proposal.date === date && (proposal.status === "PENDING" || proposal.status === "ACCEPTED")).map((proposal) => proposal.receiverId)).size;
}

export function validateProposalStatusTransition(proposal: MeetingProposal, actorId: string, targetStatus: ProposalStatus, clock: Date): ProposalTransitionValidation {
  if (actorId !== proposal.senderId && actorId !== proposal.receiverId) return { allowed: false, code: "PROPOSAL_STATUS_CHANGE_FORBIDDEN" };
  if (proposal.status === "PENDING") {
    if ((targetStatus === "ACCEPTED" || targetStatus === "REJECTED") && actorId === proposal.receiverId) return { allowed: true };
    if (targetStatus === "CANCELED" && actorId === proposal.senderId) return { allowed: true };
    return { allowed: false, code: targetStatus === "PENDING" ? "PROPOSAL_STATUS_CONFLICT" : "PROPOSAL_STATUS_CHANGE_FORBIDDEN" };
  }
  if (proposal.status === "ACCEPTED" && targetStatus === "CANCELED") {
    if (!isMeetingStartInFuture(proposal.date, proposal.startTime, clock)) return { allowed: false, code: "PROPOSAL_ALREADY_STARTED" };
    return { allowed: true };
  }
  return { allowed: false, code: "PROPOSAL_STATUS_CONFLICT" };
}

export function isSlotContained(slots: TimeSlot[], dayOfWeek: DayOfWeek, startTime: string, endTime: string): boolean {
  const start = parseTime(startTime)!;
  const end = parseTime(endTime)!;
  return slots.some((slot) => slot.dayOfWeek === dayOfWeek && parseTime(slot.startTime)! <= start && end <= parseTime(slot.endTime)!);
}

export function inspectMeetingDateTime(date: string, startTime: string, endTime: string, clock: Date): MeetingTimeInspection {
  const calendarDate = parseCalendarDate(date);
  if (!calendarDate) return { ok: false, code: "INVALID_DATE" };
  const dayNumber = calendarDate.getUTCDay();
  if (dayNumber === 0 || dayNumber === 6) return { ok: false, code: "DATE_WEEKDAY_MISMATCH" };
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start === null || end === null || start >= end) return { ok: false, code: "INVALID_TIME_RANGE" };
  if (start % 30 !== 0 || end % 30 !== 0) return { ok: false, code: "INVALID_TIME_UNIT" };
  const startAt = new Date(`${date}T${startTime}:00+09:00`);
  if (startAt.getTime() <= clock.getTime()) return { ok: false, code: "NOT_FUTURE" };
  return { ok: true, dayOfWeek: DAYS[dayNumber - 1]!, startAt };
}

export function isMeetingStartInFuture(date: string, startTime: string, clock: Date): boolean {
  const startsAt = new Date(`${date}T${startTime}:00+09:00`);
  return !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > clock.getTime();
}

export function nextDateForDay(dayOfWeek: DayOfWeek, clock: Date): string {
  const kst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(clock);
  const part = (type: Intl.DateTimeFormatPartTypes): string => kst.find((item) => item.type === type)?.value ?? "";
  const today = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day"))));
  const daysUntil = (dayRank(dayOfWeek) + 1 - today.getUTCDay() + 7) % 7;
  today.setUTCDate(today.getUTCDate() + daysUntil);
  return today.toISOString().slice(0, 10);
}

export function publicCommonSlots(slots: CommonSlot[], clock: Date): Array<CommonSlot & { nextDate: string }> {
  return sortCommonSlots(slots).slice(0, 3).map((slot) => ({ ...slot, nextDate: nextDateForDay(slot.dayOfWeek, clock) }));
}

export function matchSummary(slots: CommonSlot[], score: MatchScore): string {
  const slot = sortCommonSlots(slots)[0];
  if (!slot) return "공통 가능 시간을 확인해 보세요.";
  const dayLabel: Record<DayOfWeek, string> = { MONDAY: "월요일", TUESDAY: "화요일", WEDNESDAY: "수요일", THURSDAY: "목요일", FRIDAY: "금요일" };
  const shared = score.commonActivities.includes("LUNCH") ? "두 분 모두 점심을 선호해요." : "공통 관심사를 바탕으로 대화를 시작해 보세요.";
  return `${dayLabel[slot.dayOfWeek]} ${slot.startTime}~${slot.endTime}에 ${slot.durationMinutes}분 동안 만날 수 있고, ${shared}`;
}

export function venueRecommendationReason(venue: Venue, durationMinutes: number): string {
  if (durationMinutes <= 60 && venue.walkMinutes <= 5 && venue.tags.includes("QUICK_MEAL")) return `${durationMinutes}분 일정이라 도보 ${venue.walkMinutes}분이고 빠르게 식사하기 좋은 장소를 추천해요.`;
  if (durationMinutes >= 90 && venue.tags.includes("GOOD_FOR_TALKING")) return `${durationMinutes}분 동안 여유 있게 대화하며 식사하기 좋은 장소예요.`;
  if (venue.category === "RESTAURANT") return "점심 식사에 적합한 사전 검수 장소를 추천해요.";
  return "식사 후 편하게 이야기하기 좋은 사전 검수 장소예요.";
}

function hasMutualLanguageExchange(left: UserMatchView, right: UserMatchView): boolean {
  if (!left.activities.includes("LANGUAGE_EXCHANGE") || !right.activities.includes("LANGUAGE_EXCHANGE")) return false;
  return left.languages.speaks.some((language) => right.languages.learning.includes(language)) && right.languages.speaks.some((language) => left.languages.learning.includes(language));
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function parseCalendarDate(value: string): Date | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return null;
  const result = new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])));
  return result.getUTCFullYear() === Number(matched[1]) && result.getUTCMonth() === Number(matched[2]) - 1 && result.getUTCDate() === Number(matched[3]) ? result : null;
}

function sortCommonSlots(slots: CommonSlot[]): CommonSlot[] {
  return [...slots].toSorted((left, right) => right.durationMinutes - left.durationMinutes || dayRank(left.dayOfWeek) - dayRank(right.dayOfWeek) || left.startTime.localeCompare(right.startTime));
}
