import { describe, expect, it } from "vitest";
import { calculateMatchScore, countDailyProposalRecipients, intersectCommonSlots, isTimeOverlap, rankVenues, validateProposalStatusTransition } from "../src/domain/social.js";
import type { MeetingProposal, UserMatchView, Venue } from "../src/domain/types.js";

const user = (userId: string, overrides: Partial<UserMatchView> = {}): UserMatchView => ({
  userId,
  nickname: userId,
  grade: "3",
  schoolId: "school",
  campusId: "campus",
  campusName: "캠퍼스",
  activities: ["LUNCH"],
  interests: ["MUSIC"],
  languages: { speaks: [], learning: [] },
  isDiscoverable: true,
  minimumMeetingMinutes: 60,
  isActive: true,
  ...overrides
});

const proposal = (overrides: Partial<MeetingProposal> = {}): MeetingProposal => ({
  id: "proposal_1",
  senderId: "user_a",
  receiverId: "user_b",
  date: "2026-08-17",
  startTime: "12:00",
  endTime: "13:00",
  activity: "LUNCH",
  venue: { type: "CUSTOM", venueId: null, name: "학생회관", walkMinutes: null, priceRange: null },
  message: null,
  status: "PENDING",
  createdAt: "2026-08-16T00:00:00.000Z",
  respondedAt: null,
  canceledBy: null,
  ...overrides
});

describe("Social Flow domain rules", () => {
  it("intersects availability and keeps adjacent appointments non-overlapping", () => {
    const common = intersectCommonSlots(
      [{ dayOfWeek: "MONDAY", startTime: "11:30", endTime: "13:30", durationMinutes: 120 }],
      [{ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "14:00", durationMinutes: 120 }]
    );

    expect(common).toEqual([{ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "13:30", durationMinutes: 90 }]);
    expect(isTimeOverlap("12:00", "13:00", "13:00", "14:00")).toBe(false);
    expect(isTimeOverlap("12:00", "13:00", "12:30", "13:30")).toBe(true);
  });

  it("keeps match-score reasons equal to the displayed total", () => {
    const current = user("user_a", { activities: ["LUNCH", "LANGUAGE_EXCHANGE"], languages: { speaks: ["KO"], learning: ["EN"] } });
    const candidate = user("user_b", { activities: ["LUNCH", "LANGUAGE_EXCHANGE"], languages: { speaks: ["EN"], learning: ["KO"] } });
    const score = calculateMatchScore(current, candidate, [{ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "13:30", durationMinutes: 90 }]);

    expect(score.score).toBe(score.reasons.reduce((total, reason) => total + reason.score, 0));
    expect(score.reasons.map((reason) => reason.type)).toContain("LANGUAGE_EXCHANGE");
  });

  it("ranks a nearby quick lunch venue first", () => {
    const venues: Venue[] = [
      { id: "far", campusId: "campus", name: "먼 식당", category: "RESTAURANT", walkMinutes: 10, priceRange: "UNDER_10000", tags: [], description: "", isActive: true },
      { id: "quick", campusId: "campus", name: "가까운 식당", category: "RESTAURANT", walkMinutes: 3, priceRange: "UNDER_10000", tags: ["QUICK_MEAL"], description: "", isActive: true }
    ];

    expect(rankVenues(venues, 60)[0]?.venue.id).toBe("quick");
  });

  it("counts distinct active recipients and enforces status permissions", () => {
    const proposals = [proposal(), proposal({ id: "proposal_2", receiverId: "user_c", status: "ACCEPTED" }), proposal({ id: "proposal_3", receiverId: "user_b", startTime: "13:00", endTime: "14:00" }), proposal({ id: "proposal_4", receiverId: "user_d", status: "REJECTED" })];

    expect(countDailyProposalRecipients(proposals, "user_a", "2026-08-17")).toBe(2);
    expect(validateProposalStatusTransition(proposal(), "user_b", "ACCEPTED", new Date("2026-08-16T00:00:00.000Z"))).toEqual({ allowed: true });
    expect(validateProposalStatusTransition(proposal(), "user_a", "ACCEPTED", new Date("2026-08-16T00:00:00.000Z"))).toEqual({ allowed: false, code: "PROPOSAL_STATUS_CHANGE_FORBIDDEN" });
  });
});
