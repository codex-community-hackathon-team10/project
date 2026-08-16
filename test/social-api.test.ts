import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Profile } from "../src/domain/types.js";
import { createSeedStore, MemoryStore } from "../src/store.js";

const clock = () => new Date("2026-08-16T00:00:00.000Z");

function profile(userId: string, nickname: string, interests: string[] = ["MUSIC"]): Profile {
  return {
    userId,
    schoolId: "school_yonsei",
    campusId: "campus_yonsei_sinchon",
    nickname,
    major: "컴퓨터과학과",
    grade: "3",
    studentType: "DOMESTIC",
    activities: ["LUNCH"],
    interests,
    languages: { speaks: [], learning: [] },
    updatedAt: clock().toISOString()
  };
}

async function socialStore() {
  const store = createSeedStore();
  await store.saveProfile(profile("user_a", "민지"));
  await store.saveProfile(profile("user_b", "Alex"));
  await store.saveProfile(profile("user_hidden", "숨김"));
  await store.savePreference({ userId: "user_hidden", isDiscoverable: false, minimumMeetingMinutes: 60, updatedAt: clock().toISOString() });
  for (const userId of ["user_a", "user_b", "user_hidden"]) {
    await store.saveAvailability(userId, [{ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "14:00" }]);
  }
  return store;
}

function socialApp(store: MemoryStore) {
  return createApp({ store, clock });
}

async function preparedSocialApp() {
  return socialApp(await socialStore());
}

function client(app: ReturnType<typeof createApp>, userId: string) {
  const authorized = (method: "get" | "post" | "patch") => (path: string) => request(app)[method](path).set("authorization", `Bearer demo:${userId}`);
  return { get: authorized("get"), post: authorized("post"), patch: authorized("patch") };
}

describe("Social Flow API", () => {
  it("recommends only eligible candidates and keeps score reasons consistent", async () => {
    const app = await preparedSocialApp();
    const response = await client(app, "user_a").get("/api/v1/matches").expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ userId: "user_b", commonSlots: [expect.objectContaining({ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "14:00", durationMinutes: 120 })] });
    expect(response.body.data[0].score).toBe(response.body.data[0].reasons.reduce((total: number, reason: { score: number }) => total + reason.score, 0));
    expect(response.body.data[0]).not.toHaveProperty("major");
  });

  it("prioritizes a quick nearby venue for a 60-minute lunch", async () => {
    const app = await preparedSocialApp();
    const response = await client(app, "user_a").get("/api/v1/venues/recommendations?campusId=campus_yonsei_sinchon&date=2026-08-17&startTime=12:00&endTime=13:00&activity=LUNCH").expect(200);

    expect(response.body.data).toHaveLength(3);
    expect(response.body.data[0]).toMatchObject({ id: "venue_student_hall", walkMinutes: 3, reasonSource: "TEMPLATE" });
  });

  it("returns an empty venue list that still allows direct input", async () => {
    const store = new MemoryStore({
      schools: [{ id: "school_yonsei", name: "연세대학교", isActive: true }],
      campuses: [{ id: "campus_yonsei_sinchon", schoolId: "school_yonsei", name: "신촌캠퍼스", timeZone: "Asia/Seoul", isActive: true }]
    });
    const response = await client(createApp({ store, clock }), "user_a").get("/api/v1/venues/recommendations?campusId=campus_yonsei_sinchon&date=2026-08-17&startTime=12:00&endTime=13:00&activity=LUNCH").expect(200);

    expect(response.body).toMatchObject({ data: [], meta: { emptyReason: "NO_VENUE_CANDIDATES", allowCustomVenue: true } });
  });

  it("creates, accepts, and lists an accepted proposal without an appointment resource", async () => {
    const app = await preparedSocialApp();
    const sender = client(app, "user_a");
    const created = await sender.post("/api/v1/meeting-proposals").send({
      receiverId: "user_b",
      date: "2026-08-17",
      startTime: "12:00",
      endTime: "13:00",
      activity: "LUNCH",
      venue: { type: "RECOMMENDED", venueId: "venue_student_hall" },
      message: "같이 점심 먹어요!"
    }).expect(201);

    expect(created.body.data).toMatchObject({ status: "PENDING", venue: { type: "RECOMMENDED", venueId: "venue_student_hall", name: "학생회관 식당" } });
    await client(app, "user_b").patch(`/api/v1/meeting-proposals/${created.body.data.id}/status`).send({ status: "ACCEPTED" }).expect(200);
    const accepted = await sender.get("/api/v1/meeting-proposals?status=ACCEPTED").expect(200);
    expect(accepted.body.data).toHaveLength(1);
    expect(accepted.body.data[0]).toMatchObject({ id: created.body.data.id, role: "SENT", status: "ACCEPTED" });
  });

  it("allows a direct venue when no recommendation is selected", async () => {
    const app = await preparedSocialApp();
    const sender = client(app, "user_a");
    const custom = await sender.post("/api/v1/meeting-proposals").send({
      receiverId: "user_b",
      date: "2026-08-17",
      startTime: "13:00",
      endTime: "14:00",
      activity: "LUNCH",
      venue: { type: "CUSTOM", name: "학생회관 1층" }
    }).expect(201);
    expect(custom.body.data.venue).toEqual({ type: "CUSTOM", name: "학생회관 1층" });
  });

  it("limits a sender to two distinct active recipients for one date", async () => {
    const store = await socialStore();
    for (const [userId, nickname] of [["user_c", "C"], ["user_d", "D"]] as const) {
      await store.saveProfile(profile(userId, nickname));
      await store.saveAvailability(userId, [{ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "14:00" }]);
    }
    const sender = client(socialApp(store), "user_a");
    const payload = (receiverId: string) => ({ receiverId, date: "2026-08-17", startTime: "12:00", endTime: "13:00", activity: "LUNCH", venue: { type: "RECOMMENDED", venueId: "venue_student_hall" } });

    await sender.post("/api/v1/meeting-proposals").send(payload("user_b")).expect(201);
    await sender.post("/api/v1/meeting-proposals").send(payload("user_c")).expect(201);
    const limited = await sender.post("/api/v1/meeting-proposals").send(payload("user_d")).expect(409);
    expect(limited.body.code).toBe("DAILY_PROPOSAL_LIMIT_REACHED");
  });

  it("allows only one simultaneous acceptance for overlapping proposals", async () => {
    const store = await socialStore();
    await store.saveProfile(profile("user_c", "C"));
    await store.saveAvailability("user_c", [{ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "14:00" }]);
    const app = socialApp(store);
    const sender = client(app, "user_a");
    const payload = (receiverId: string) => ({ receiverId, date: "2026-08-17", startTime: "12:00", endTime: "13:00", activity: "LUNCH", venue: { type: "RECOMMENDED", venueId: "venue_student_hall" } });
    const first = await sender.post("/api/v1/meeting-proposals").send(payload("user_b")).expect(201);
    const second = await sender.post("/api/v1/meeting-proposals").send(payload("user_c")).expect(201);

    const responses = await Promise.all([
      client(app, "user_b").patch(`/api/v1/meeting-proposals/${first.body.data.id}/status`).send({ status: "ACCEPTED" }),
      client(app, "user_c").patch(`/api/v1/meeting-proposals/${second.body.data.id}/status`).send({ status: "ACCEPTED" })
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.find((response) => response.status === 409)?.body.code).toBe("ACCEPTED_PROPOSAL_CONFLICT");
  });
});
