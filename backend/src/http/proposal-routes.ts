import { Router } from "express";
import { z } from "zod";
import type { CoreQueryPort } from "../domain/core-query-port.js";
import { countDailyProposalRecipients, inspectMeetingDateTime, intersectCommonSlots, isSlotContained, isTimeOverlap, validateProposalStatusTransition } from "../domain/social.js";
import { PRICE_RANGES, PROPOSAL_STATUSES, type MeetingProposal, type ProposalStatus, type ProposalVenue, type UserMatchView } from "../domain/types.js";
import type { SocialStore } from "../store.js";
import { currentUserId } from "./auth.js";
import { ApiError, asyncRoute } from "./errors.js";
import { page } from "./pagination.js";

const createInput = z.object({
  receiverId: z.string().min(1),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  activity: z.string(),
  venue: z.unknown(),
  message: z.string().max(200).nullable().optional()
});
const listInput = z.object({
  role: z.enum(["SENT", "RECEIVED", "ALL"]).default("ALL"),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional()
});
const statusInput = z.object({ status: z.enum(PROPOSAL_STATUSES) });

export function createProposalRouter(store: SocialStore, coreQueryPort: CoreQueryPort, clock: () => Date = () => new Date()): Router {
  const router = Router();

  router.post("/meeting-proposals", asyncRoute(async (request, response) => {
    const input = createInput.parse(request.body);
    const senderId = currentUserId(request);
    const proposal = await store.withUserLocks([senderId, input.receiverId], async () => {
      const receiverUser = await store.getUser(input.receiverId);
      if (senderId === input.receiverId || !receiverUser || !receiverUser.isActive) throw matchNotFound();

      const views = await proposalViews(coreQueryPort, senderId, input.receiverId);
      if (!isEligibleCounterpart(views.sender, views.receiver)) throw matchNotFound();

      const inspected = inspectMeetingDateTime(input.date, input.startTime, input.endTime, clock());
      if (!inspected.ok) throw proposalTimeError(inspected.code);
      if (input.activity !== "LUNCH") throw new ApiError(422, "UNSUPPORTED_ACTIVITY", "P0에서는 점심 만남만 지원합니다.");

      const commonSlots = intersectCommonSlots(await coreQueryPort.getEffectiveSlots(senderId), await coreQueryPort.getEffectiveSlots(input.receiverId));
      const minimumMinutes = Math.max(views.sender.minimumMeetingMinutes, views.receiver.minimumMeetingMinutes);
      if (!commonSlots.some((slot) => slot.durationMinutes >= minimumMinutes)) throw new ApiError(409, "COMMON_TIME_CHANGED", "공통 가능 시간이 변경되었습니다.");
      if (!isSlotContained(commonSlots, inspected.dayOfWeek, input.startTime, input.endTime)) throw new ApiError(422, "TIME_NOT_IN_COMMON_SLOT", "공통 가능 시간 안에서 선택해 주세요.");

      if (await hasAcceptedConflict(store, senderId, input.date, input.startTime, input.endTime) || await hasAcceptedConflict(store, input.receiverId, input.date, input.startTime, input.endTime)) throw new ApiError(409, "ACCEPTED_PROPOSAL_CONFLICT", "확정된 약속과 시간이 겹칩니다.");
      if (await hasPendingDuplicate(store, senderId, input.receiverId, input.date, input.startTime, input.endTime)) throw new ApiError(409, "DUPLICATE_PENDING_PROPOSAL", "같은 시간의 대기 제안이 이미 있습니다.");
      const dailyProposals = await store.listMeetingProposalsForUser(senderId);
      const maintainsReceiver = dailyProposals.some((proposal) => proposal.senderId === senderId && proposal.receiverId === input.receiverId && proposal.date === input.date && (proposal.status === "PENDING" || proposal.status === "ACCEPTED"));
      if (!maintainsReceiver && countDailyProposalRecipients(dailyProposals, senderId, input.date) >= 2) throw new ApiError(409, "DAILY_PROPOSAL_LIMIT_REACHED", "해당 날짜에는 최대 2명에게만 만남을 제안할 수 있어요.");

      const venue = await selectVenue(store, input.venue, views.sender.campusId);
      return {
        proposal: await store.createMeetingProposal({ senderId, receiverId: input.receiverId, date: input.date, startTime: input.startTime, endTime: input.endTime, activity: "LUNCH", venue, message: input.message?.trim() ?? null, status: "PENDING", respondedAt: null, canceledBy: null }),
        views
      };
    });
    response.location(`/api/v1/meeting-proposals/${proposal.proposal.id}`).status(201).json({ data: proposalDetail(proposal.proposal, proposal.views.sender, proposal.views.receiver) });
  }));

  router.get("/meeting-proposals", asyncRoute(async (request, response) => {
    const query = listInput.parse(request.query);
    const userId = currentUserId(request);
    const statuses = parseStatuses(query.status);
    const proposals = (await store.listMeetingProposalsForUser(userId)).filter((proposal) => {
      const roleMatches = query.role === "ALL" || (query.role === "SENT" && proposal.senderId === userId) || (query.role === "RECEIVED" && proposal.receiverId === userId);
      return roleMatches && (!statuses || statuses.includes(proposal.status));
    }).toSorted((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
    const result = page(proposals, query.limit, query.cursor);
    const data = await Promise.all(result.data.map(async (proposal) => proposalListItem(proposal, userId, await counterpartView(coreQueryPort, proposal, userId))));
    response.json({ data, meta: result.meta });
  }));

  router.patch("/meeting-proposals/:proposalId/status", asyncRoute(async (request, response) => {
    const input = statusInput.parse(request.body);
    const actorId = currentUserId(request);
    const proposalId = z.string().min(1).parse(request.params.proposalId);
    const initial = await store.getMeetingProposal(proposalId);
    if (!initial) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "만남 제안을 찾을 수 없습니다.");

    const updated = await store.withUserLocks([initial.senderId, initial.receiverId], async () => {
      const proposal = await store.getMeetingProposal(initial.id);
      if (!proposal) throw new ApiError(404, "PROPOSAL_NOT_FOUND", "만남 제안을 찾을 수 없습니다.");
      const currentClock = clock();
      const transition = validateProposalStatusTransition(proposal, actorId, input.status, currentClock);
      if (!transition.allowed) throw transitionError(transition.code);

      if (input.status === "ACCEPTED") await revalidateAcceptance(store, coreQueryPort, proposal, currentClock);
      const result = await store.updateMeetingProposalStatus(proposal.id, proposal.status, {
        status: input.status,
        respondedAt: input.status === "ACCEPTED" || input.status === "REJECTED" ? currentClock.toISOString() : proposal.respondedAt,
        canceledBy: input.status === "CANCELED" ? actorId : null
      });
      if (!result) throw new ApiError(409, "PROPOSAL_STATUS_CONFLICT", "제안 상태가 이미 변경되었습니다.");
      return result;
    });
    response.json({ data: { id: updated.id, status: updated.status, respondedAt: updated.respondedAt, canceledBy: updated.canceledBy } });
  }));

  return router;
}

async function proposalViews(coreQueryPort: CoreQueryPort, senderId: string, receiverId: string): Promise<{ sender: UserMatchView; receiver: UserMatchView }> {
  try {
    const [sender, receiver] = await Promise.all([coreQueryPort.getUserMatchView(senderId), coreQueryPort.getUserMatchView(receiverId)]);
    return { sender, receiver };
  } catch (error) {
    if (error instanceof ApiError && error.code === "PROFILE_NOT_FOUND") throw matchNotFound();
    throw error;
  }
}

function isEligibleCounterpart(sender: UserMatchView, receiver: UserMatchView): boolean {
  return receiver.isActive && receiver.isDiscoverable && sender.schoolId === receiver.schoolId && sender.campusId === receiver.campusId;
}

async function selectVenue(store: SocialStore, input: unknown, campusId: string): Promise<ProposalVenue> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalidVenueSelection();
  const record = input as Record<string, unknown>;
  if (record.type === "RECOMMENDED" && typeof record.venueId === "string" && record.venueId.length > 0) {
    const venue = await store.getActiveVenue(record.venueId);
    if (!venue || venue.campusId !== campusId) throw new ApiError(404, "VENUE_NOT_FOUND", "추천 장소를 찾을 수 없습니다.");
    return { type: "RECOMMENDED", venueId: venue.id, name: venue.name, walkMinutes: venue.walkMinutes, priceRange: venue.priceRange };
  }
  if (record.type === "CUSTOM" && typeof record.name === "string") {
    const name = record.name.trim();
    if (name.length >= 2 && name.length <= 50) return { type: "CUSTOM", venueId: null, name, walkMinutes: null, priceRange: null };
  }
  throw invalidVenueSelection();
}

async function revalidateAcceptance(store: SocialStore, coreQueryPort: CoreQueryPort, proposal: MeetingProposal, clock: Date): Promise<void> {
  const inspected = inspectMeetingDateTime(proposal.date, proposal.startTime, proposal.endTime, clock);
  if (!inspected.ok) {
    if (inspected.code === "NOT_FUTURE") throw new ApiError(409, "PROPOSAL_ALREADY_STARTED", "시작된 약속은 수락할 수 없습니다.");
    throw new ApiError(409, "COMMON_TIME_CHANGED", "공통 가능 시간이 변경되었습니다.");
  }
  const views = await proposalViews(coreQueryPort, proposal.senderId, proposal.receiverId);
  const commonSlots = intersectCommonSlots(await coreQueryPort.getEffectiveSlots(proposal.senderId), await coreQueryPort.getEffectiveSlots(proposal.receiverId));
  const minimumMinutes = Math.max(views.sender.minimumMeetingMinutes, views.receiver.minimumMeetingMinutes);
  if (!commonSlots.some((slot) => slot.durationMinutes >= minimumMinutes) || !isSlotContained(commonSlots, inspected.dayOfWeek, proposal.startTime, proposal.endTime)) throw new ApiError(409, "COMMON_TIME_CHANGED", "공통 가능 시간이 변경되었습니다.");
  if (await hasAcceptedConflict(store, proposal.senderId, proposal.date, proposal.startTime, proposal.endTime, proposal.id) || await hasAcceptedConflict(store, proposal.receiverId, proposal.date, proposal.startTime, proposal.endTime, proposal.id)) throw new ApiError(409, "ACCEPTED_PROPOSAL_CONFLICT", "확정된 약속과 시간이 겹칩니다.");
}

async function hasAcceptedConflict(store: SocialStore, userId: string, date: string, startTime: string, endTime: string, excludedProposalId?: string): Promise<boolean> {
  return (await store.listMeetingProposalsForUser(userId)).some((proposal) => proposal.id !== excludedProposalId && proposal.status === "ACCEPTED" && proposal.date === date && isTimeOverlap(startTime, endTime, proposal.startTime, proposal.endTime));
}

async function hasPendingDuplicate(store: SocialStore, senderId: string, receiverId: string, date: string, startTime: string, endTime: string): Promise<boolean> {
  const pair = [senderId, receiverId].sort().join(":");
  return (await store.listMeetingProposalsForUser(senderId)).some((proposal) => [proposal.senderId, proposal.receiverId].sort().join(":") === pair && proposal.date === date && proposal.startTime === startTime && proposal.endTime === endTime && proposal.status === "PENDING");
}

function proposalDetail(proposal: MeetingProposal, sender: UserMatchView, receiver: UserMatchView) {
  return {
    id: proposal.id,
    sender: { id: sender.userId, nickname: sender.nickname },
    receiver: { id: receiver.userId, nickname: receiver.nickname },
    date: proposal.date,
    startTime: proposal.startTime,
    endTime: proposal.endTime,
    activity: proposal.activity,
    venue: publicVenue(proposal.venue),
    message: proposal.message,
    status: proposal.status,
    createdAt: proposal.createdAt,
    respondedAt: proposal.respondedAt,
    canceledBy: proposal.canceledBy
  };
}

function proposalListItem(proposal: MeetingProposal, currentUserId: string, counterpart: UserMatchView) {
  return {
    id: proposal.id,
    role: proposal.senderId === currentUserId ? "SENT" : "RECEIVED",
    counterpart: { id: counterpart.userId, nickname: counterpart.nickname },
    date: proposal.date,
    startTime: proposal.startTime,
    endTime: proposal.endTime,
    activity: proposal.activity,
    venue: publicVenue(proposal.venue),
    status: proposal.status,
    createdAt: proposal.createdAt
  };
}

function publicVenue(venue: ProposalVenue) {
  return venue.type === "RECOMMENDED" ? { type: venue.type, venueId: venue.venueId!, name: venue.name, walkMinutes: venue.walkMinutes!, priceRange: venue.priceRange! } : { type: venue.type, name: venue.name };
}

async function counterpartView(coreQueryPort: CoreQueryPort, proposal: MeetingProposal, userId: string): Promise<UserMatchView> {
  return coreQueryPort.getUserMatchView(proposal.senderId === userId ? proposal.receiverId : proposal.senderId);
}

function parseStatuses(raw: string | undefined): ProposalStatus[] | undefined {
  if (raw === undefined) return undefined;
  const values = raw.split(",").filter(Boolean);
  if (values.length === 0 || values.some((value) => !PROPOSAL_STATUSES.includes(value as ProposalStatus))) throw new ApiError(422, "VALIDATION_ERROR", "status 값을 확인해 주세요.");
  return values as ProposalStatus[];
}

function proposalTimeError(code: "INVALID_DATE" | "DATE_WEEKDAY_MISMATCH" | "INVALID_TIME_RANGE" | "INVALID_TIME_UNIT" | "NOT_FUTURE"): ApiError {
  if (code === "DATE_WEEKDAY_MISMATCH" || code === "INVALID_DATE") return new ApiError(422, "DATE_WEEKDAY_MISMATCH", "평일 날짜를 선택해 주세요.");
  if (code === "INVALID_TIME_UNIT") return new ApiError(422, "INVALID_TIME_UNIT", "시각은 30분 단위여야 합니다.");
  return new ApiError(422, "INVALID_TIME_RANGE", "미래의 올바른 시간 범위를 선택해 주세요.");
}

function transitionError(code: "PROPOSAL_STATUS_CHANGE_FORBIDDEN" | "PROPOSAL_STATUS_CONFLICT" | "PROPOSAL_ALREADY_STARTED"): ApiError {
  return new ApiError(code === "PROPOSAL_STATUS_CHANGE_FORBIDDEN" ? 403 : 409, code, code === "PROPOSAL_STATUS_CHANGE_FORBIDDEN" ? "이 상태 변경 권한이 없습니다." : code === "PROPOSAL_ALREADY_STARTED" ? "시작된 약속은 변경할 수 없습니다." : "제안 상태가 이미 변경되었습니다.");
}

function matchNotFound(): ApiError {
  return new ApiError(404, "MATCH_NOT_FOUND", "제안 가능한 메이트를 찾을 수 없습니다.");
}

function invalidVenueSelection(): ApiError {
  return new ApiError(422, "INVALID_VENUE_SELECTION", "추천 장소 또는 직접 입력 장소를 확인해 주세요.");
}
