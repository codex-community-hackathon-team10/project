import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AiMatchRanking, AiVenueRanking, ParsedIntent, RecommendationAi } from "../src/ai-recommendation-service.js";
import { createApp } from "../src/app.js";
import type { MatchConversationIntent, Profile } from "../src/domain/types.js";
import { createSeedStore } from "../src/store.js";

const clock = () => new Date("2026-08-16T00:00:00.000Z");

class FakeRecommendationAi implements RecommendationAi {
  isEnabled(): boolean { return true; }
  async parseIntent({ message, previousIntent }: { message: string; previousIntent: MatchConversationIntent; today: string }): Promise<ParsedIntent> {
    const dayOfWeek = message.includes("목요일") ? "THURSDAY" : message.includes("월요일") ? "MONDAY" : previousIntent.dayOfWeek;
    return { date: null, dayOfWeek, startTime: previousIntent.startTime ?? "12:00", durationMinutes: previousIntent.durationMinutes ?? 60, budget: previousIntent.budget, atmosphere: previousIntent.atmosphere, assistantMessage: "조건을 확인했어요." };
  }
  async rankMatches(): Promise<AiMatchRanking> {
    return { assistantMessage: "공통 시간이 잘 맞는 메이트를 찾았어요.", matches: [{ candidateId: "user_b", reason: "월요일 점심에 한 시간 함께할 수 있어 추천해요.", evidence: ["COMMON_TIME", "COMMON_ACTIVITY", "COMMON_INTEREST"] }] };
  }
  async rankVenues(): Promise<AiVenueRanking> {
    return { venues: [{ venueId: "venue_student_hall", reason: "한 시간 점심에 도보 3분으로 빠르게 다녀오기 좋아요." }] };
  }
}

function profile(userId: string, nickname: string): Profile {
  return { userId, schoolId: "school_yonsei", campusId: "campus_yonsei_sinchon", nickname, major: "컴퓨터과학과", grade: "3", studentType: "DOMESTIC", activities: ["LUNCH"], interests: ["MUSIC"], languages: { speaks: [], learning: [] }, updatedAt: clock().toISOString() };
}

async function app() {
  const store = createSeedStore();
  await store.saveProfile(profile("user_a", "민지"));
  await store.saveProfile(profile("user_b", "Alex"));
  await store.saveAvailability("user_a", [
    { dayOfWeek: "MONDAY", startTime: "12:00", endTime: "14:00" },
    { dayOfWeek: "THURSDAY", startTime: "12:00", endTime: "14:00" }
  ]);
  await store.saveAvailability("user_b", [
    { dayOfWeek: "MONDAY", startTime: "12:00", endTime: "14:00" },
    { dayOfWeek: "THURSDAY", startTime: "12:00", endTime: "14:00" }
  ]);
  return createApp({ store, clock, recommendationAi: new FakeRecommendationAi() });
}

describe("Match conversation API", () => {
  it("keeps normalized context and returns an AI-ranked selected slot", async () => {
    const service = await app();
    const first = await request(service).post("/api/v1/match-conversations/messages").set("authorization", "Bearer demo:user_a").send({ message: "월요일 12시에 한 시간 점심 친구 찾아줘" }).expect(200);

    expect(first.body.data).toMatchObject({ status: "MATCHES_FOUND", parsedIntent: { date: "2026-08-17", startTime: "12:00", endTime: "13:00", durationMinutes: 60, missingFields: [] } });
    expect(first.body.data.matches[0]).toMatchObject({ userId: "user_b", summarySource: "AI", selectedSlot: { dayOfWeek: "MONDAY", startTime: "12:00", endTime: "13:00", nextDate: "2026-08-17" } });

    const second = await request(service).post("/api/v1/match-conversations/messages").set("authorization", "Bearer demo:user_a").send({ conversationId: first.body.data.conversationId, message: "아니, 목요일로 바꿔줘" }).expect(200);
    expect(second.body.data).toMatchObject({ parsedIntent: { date: "2026-08-20", startTime: "12:00", endTime: "13:00" }, matches: [expect.objectContaining({ selectedSlot: expect.objectContaining({ dayOfWeek: "THURSDAY" }) })] });
  });

  it("uses the AI-ranked venue reason only for a vetted venue", async () => {
    const service = await app();
    const response = await request(service).get("/api/v1/venues/recommendations?campusId=campus_yonsei_sinchon&date=2026-08-17&startTime=12:00&endTime=13:00&activity=LUNCH").set("authorization", "Bearer demo:user_a").expect(200);
    expect(response.body.data[0]).toMatchObject({ id: "venue_student_hall", reasonSource: "AI" });
  });
});
