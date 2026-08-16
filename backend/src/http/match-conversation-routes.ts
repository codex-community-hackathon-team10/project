import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { RecommendationAi } from "../ai-recommendation-service.js";
import type { CoreQueryPort } from "../domain/core-query-port.js";
import { inspectMeetingDateTime, matchSummary, nextDateForDay, publicCommonSlots } from "../domain/social.js";
import { DAYS, type DayOfWeek, type MatchConversation, type MatchConversationIntent, type TimeSlot } from "../domain/types.js";
import { listEligibleMatchCandidates, type MatchCandidate } from "../match-candidates.js";
import type { SocialStore } from "../store.js";
import { currentUserId } from "./auth.js";
import { ApiError, asyncRoute } from "./errors.js";

const inputSchema = z.object({ conversationId: z.string().uuid().optional(), message: z.string().trim().min(1).max(500) });
const emptyIntent = (): MatchConversationIntent => ({ date: null, dayOfWeek: null, startTime: null, durationMinutes: null, budget: null, atmosphere: null });
const clockInKstDate = (clock: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(clock);

type ResolvedIntent = {
  intent: MatchConversationIntent;
  missingFields: string[];
  endTime: string | null;
};

export function createMatchConversationRouter(store: SocialStore, coreQueryPort: CoreQueryPort, recommendationAi: RecommendationAi, clock: () => Date = () => new Date()): Router {
  const router = Router();
  router.post("/match-conversations/messages", asyncRoute(async (request, response) => {
    const input = inputSchema.parse(request.body);
    const userId = currentUserId(request);
    const now = clock();
    const conversation = input.conversationId ? await store.getMatchConversation(input.conversationId, userId, now) : undefined;
    if (input.conversationId && !conversation) throw new ApiError(404, "MATCH_CONVERSATION_NOT_FOUND", "대화 세션을 찾을 수 없습니다. 새 대화를 시작해 주세요.");

    let intent = conversation?.intent ?? emptyIntent();
    let assistantMessage = "요청을 이해하지 못했어요. 날짜, 시작 시간, 만남 길이를 알려 주세요.";
    if (recommendationAi.isEnabled()) {
      try {
        const parsed = await recommendationAi.parseIntent({ message: input.message, previousIntent: intent, today: clockInKstDate(now) });
        intent = { date: parsed.date, dayOfWeek: parsed.dayOfWeek, startTime: parsed.startTime, durationMinutes: parsed.durationMinutes, budget: parsed.budget, atmosphere: parsed.atmosphere };
        assistantMessage = parsed.assistantMessage;
      } catch {
        return response.json(await fallbackResponse(store, coreQueryPort, userId, conversation, now));
      }
    }

    const storedIntent = normalizeStoredIntent(intent);
    const resolved = resolveIntent(storedIntent, now);
    // Keep the user/model's expression (for example, "Thursday" rather than
    // the derived calendar date) so a later chat turn can safely change it.
    const savedConversation = await store.saveMatchConversation(createConversation(userId, conversation, storedIntent, now));
    if (resolved.missingFields.length > 0) {
      response.json({ data: { conversationId: savedConversation.id, status: "NEEDS_CLARIFICATION", assistantMessage: clarificationMessage(resolved.missingFields, assistantMessage), parsedIntent: publicIntent(resolved), matches: [] } });
      return;
    }

    const candidates = await listEligibleMatchCandidates(coreQueryPort, userId);
    const suitable = candidates.flatMap((candidate) => {
      const selectedSlot = slotForIntent(candidate.commonSlots, resolved.intent, resolved.endTime!);
      return selectedSlot ? [{ candidate, selectedSlot }] : [];
    });
    if (suitable.length === 0) {
      response.json({ data: { conversationId: savedConversation.id, status: "NO_MATCHES", assistantMessage: "조건에 맞는 메이트가 아직 없어요. 다른 요일이나 시간을 알려 주세요.", parsedIntent: publicIntent(resolved), matches: [] } });
      return;
    }

    const pool = suitable.slice(0, 50);
    let ordered: Array<{ candidate: MatchCandidate; selectedSlot: TimeSlot & { nextDate: string }; summary: string; summarySource: "AI" | "TEMPLATE" }> = pool.map(({ candidate, selectedSlot }) => ({ candidate, selectedSlot, summary: matchSummary(candidate.commonSlots, candidate.score), summarySource: "TEMPLATE" }));
    let resultMessage = "공통 시간과 활동이 잘 맞는 메이트를 찾았어요.";
    let status: "MATCHES_FOUND" | "FALLBACK" = "FALLBACK";
    if (recommendationAi.isEnabled()) {
      try {
        const ranking = await recommendationAi.rankMatches({
          intent: resolved.intent,
          candidates: pool.map(({ candidate, selectedSlot }) => ({
            id: candidate.view.userId,
            commonSlot: { dayOfWeek: selectedSlot.dayOfWeek, startTime: selectedSlot.startTime, endTime: selectedSlot.endTime, durationMinutes: selectedSlot.durationMinutes },
            commonActivities: candidate.score.commonActivities,
            commonInterests: candidate.score.commonInterests,
            score: candidate.score.score,
            evidence: candidate.score.reasons.map((reason) => reason.type)
          }))
        });
        const choices = new Map(pool.map((item) => [item.candidate.view.userId, item]));
        const accepted = ranking.matches.flatMap((selection) => {
          const item = choices.get(selection.candidateId);
          const actualEvidence = new Set(item?.candidate.score.reasons.map((reason) => reason.type));
          if (!item || selection.evidence.some((evidence) => !actualEvidence.has(evidence))) return [];
          choices.delete(selection.candidateId);
          return [{ ...item, summary: selection.reason, summarySource: "AI" as const }];
        });
        if (accepted.length > 0) {
          ordered = accepted;
          resultMessage = ranking.assistantMessage;
          status = "MATCHES_FOUND";
        }
      } catch {
        // Deterministic ordering and template reasons are intentionally retained below.
      }
    }

    response.json({ data: {
      conversationId: savedConversation.id,
      status,
      assistantMessage: resultMessage,
      parsedIntent: publicIntent(resolved),
      matches: ordered.slice(0, 5).map(({ candidate, selectedSlot, summary, summarySource }) => publicMatch(candidate, selectedSlot, now, summary, summarySource))
    } });
  }));
  return router;
}

async function fallbackResponse(store: SocialStore, coreQueryPort: CoreQueryPort, userId: string, conversation: MatchConversation | undefined, now: Date) {
  const savedConversation = await store.saveMatchConversation(createConversation(userId, conversation, conversation?.intent ?? emptyIntent(), now));
  const candidates = await listEligibleMatchCandidates(coreQueryPort, userId);
  return { data: {
    conversationId: savedConversation.id,
    status: "FALLBACK",
    assistantMessage: "AI 연결을 준비 중이라 공통 공강 기준으로 메이트를 추천했어요.",
    parsedIntent: publicIntent({ intent: savedConversation.intent, missingFields: [], endTime: null }),
    matches: candidates.slice(0, 5).flatMap((candidate) => {
      const selectedSlot = publicCommonSlots(candidate.commonSlots, now)[0];
      return selectedSlot ? [publicMatch(candidate, selectedSlot, now, matchSummary(candidate.commonSlots, candidate.score), "TEMPLATE")] : [];
    })
  } };
}

function createConversation(userId: string, previous: MatchConversation | undefined, intent: MatchConversationIntent, now: Date): MatchConversation {
  return { id: previous?.id ?? randomUUID(), userId, intent, createdAt: previous?.createdAt ?? now.toISOString(), updatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() };
}

function resolveIntent(input: MatchConversationIntent, now: Date): ResolvedIntent {
  let date = validDate(input.date) ? input.date : null;
  let dayOfWeek = input.dayOfWeek ?? (date ? dayForDate(date) : null);
  // A stored relative day can coexist with a derived date from an earlier
  // turn. If the newest parsed day differs, derive its new date instead.
  if (date && dayOfWeek && dayForDate(date) !== dayOfWeek) date = null;
  const dateWasDerived = date === null && dayOfWeek !== null;
  if (!date && dayOfWeek) date = nextDateForDay(dayOfWeek, now);
  const endTime = input.startTime && input.durationMinutes ? addMinutes(input.startTime, input.durationMinutes) : null;
  if (date && dayOfWeek && input.startTime && endTime) {
    const inspected = inspectMeetingDateTime(date, input.startTime, endTime, now);
    if (!inspected.ok && dateWasDerived && inspected.code === "NOT_FUTURE") {
      date = addDays(date, 7);
      dayOfWeek = dayForDate(date);
    } else if (!inspected.ok) {
      date = null;
      dayOfWeek = null;
    }
  }
  const missingFields = [
    !date || !dayOfWeek ? "DATE" : null,
    !input.startTime ? "START_TIME" : null,
    !input.durationMinutes || !endTime ? "DURATION" : null
  ].filter((value): value is string => value !== null);
  return { intent: { ...input, date, dayOfWeek }, missingFields, endTime };
}

function slotForIntent(slots: TimeSlot[], intent: MatchConversationIntent, endTime: string): TimeSlot & { nextDate: string } | null {
  if (!intent.dayOfWeek || !intent.date || !intent.startTime) return null;
  const selected = slots.find((slot) => slot.dayOfWeek === intent.dayOfWeek && slot.startTime <= intent.startTime! && endTime <= slot.endTime);
  return selected ? { dayOfWeek: selected.dayOfWeek, startTime: intent.startTime, endTime, durationMinutes: minutesBetween(intent.startTime, endTime), nextDate: intent.date } : null;
}

function publicMatch(candidate: MatchCandidate, selectedSlot: TimeSlot & { nextDate?: string }, now: Date, summary: string, summarySource: "AI" | "TEMPLATE") {
  return {
    userId: candidate.view.userId,
    nickname: candidate.view.nickname,
    grade: candidate.view.grade,
    campus: { id: candidate.view.campusId, name: candidate.view.campusName },
    commonSlots: publicCommonSlots(candidate.commonSlots, now),
    selectedSlot: { ...selectedSlot, nextDate: selectedSlot.nextDate ?? publicCommonSlots(candidate.commonSlots, now)[0]?.nextDate },
    commonActivities: candidate.score.commonActivities,
    commonInterests: candidate.score.commonInterests,
    score: candidate.score.score,
    reasons: candidate.score.reasons,
    summary,
    summarySource
  };
}

function publicIntent(resolved: ResolvedIntent) {
  return { date: resolved.intent.date ?? undefined, startTime: resolved.intent.startTime ?? undefined, endTime: resolved.endTime ?? undefined, durationMinutes: resolved.intent.durationMinutes ?? undefined, activity: "LUNCH" as const, budget: resolved.intent.budget ?? undefined, atmosphere: resolved.intent.atmosphere ?? undefined, missingFields: resolved.missingFields };
}

function clarificationMessage(missingFields: string[], modelMessage: string): string {
  if (modelMessage) return modelMessage;
  const labels = missingFields.map((field) => ({ DATE: "날짜 또는 요일", START_TIME: "시작 시간", DURATION: "만남 길이" })[field]);
  return `${labels.join(", ")}을 알려 주세요.`;
}

function normalizeStoredIntent(intent: MatchConversationIntent): MatchConversationIntent {
  return { ...intent, date: validDate(intent.date) ? intent.date : null };
}

function validDate(value: string | null): value is string {
  if (value === null) return false;
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return false;
  const date = new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])));
  return date.getUTCFullYear() === Number(matched[1]) && date.getUTCMonth() === Number(matched[2]) - 1 && date.getUTCDate() === Number(matched[3]);
}
function dayForDate(date: string): DayOfWeek | null { const day = new Date(`${date}T00:00:00Z`).getUTCDay(); return day >= 1 && day <= 5 ? DAYS[day - 1]! : null; }
function addMinutes(startTime: string, duration: number): string | null { const [hour, minute] = startTime.split(":").map(Number); const total = hour * 60 + minute + duration; return total < 24 * 60 ? `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` : null; }
function minutesBetween(start: string, end: string): number { const value = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; }; return value(end) - value(start); }
function addDays(date: string, days: number): string { const result = new Date(`${date}T00:00:00Z`); result.setUTCDate(result.getUTCDate() + days); return result.toISOString().slice(0, 10); }
