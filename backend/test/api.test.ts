import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createSeedStore } from "../src/store.js";

const authenticated = () => {
  const app = createApp({ store: createSeedStore() });
  return { get: (path: string) => request(app).get(path).set("authorization", "Bearer demo:user_a"), post: (path: string) => request(app).post(path).set("authorization", "Bearer demo:user_a"), put: (path: string) => request(app).put(path).set("authorization", "Bearer demo:user_a"), patch: (path: string) => request(app).patch(path).set("authorization", "Bearer demo:user_a"), delete: (path: string) => request(app).delete(path).set("authorization", "Bearer demo:user_a") };
};

describe("Core Time API", () => {
  it("requires a verified provider token", async () => {
    const response = await request(createApp()).get("/api/v1/schools");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTH_REQUIRED");
  });

  it("saves default-compatible profile and match preferences", async () => {
    const client = authenticated();
    const preference = await client.get("/api/v1/me/match-preferences");
    expect(preference.body.data).toMatchObject({ isDiscoverable: true, minimumMeetingMinutes: 60 });
    const response = await client.put("/api/v1/me/profile").send({ schoolId: "school_yonsei", campusId: "campus_yonsei_sinchon", nickname: "민지", major: "컴퓨터과학과", grade: "3", studentType: "DOMESTIC", activities: ["LUNCH"], interests: ["MUSIC"], languages: { speaks: [], learning: [] } });
    expect(response.status).toBe(200);
    expect(response.body.data.isComplete).toBe(true);
  });

  it("rejects overlapping schedules and calculates updated free time", async () => {
    const client = authenticated();
    await client.post("/api/v1/me/schedules").send({ dayOfWeek: "MONDAY", subjectName: "통계", startTime: "10:00", endTime: "12:00", classroom: null }).expect(201);
    const overlap = await client.post("/api/v1/me/schedules").send({ dayOfWeek: "MONDAY", subjectName: "알고리즘", startTime: "11:30", endTime: "13:00", classroom: null });
    expect(overlap.status).toBe(409);
    expect(overlap.body.code).toBe("SCHEDULE_TIME_OVERLAP");
    const freeTimes = await client.get("/api/v1/me/free-times");
    expect(freeTimes.body.data.slots).toContainEqual(expect.objectContaining({ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "15:00" }));
  });

  it("merges preferred availability and returns its free-time intersection", async () => {
    const client = authenticated();
    await client.post("/api/v1/me/schedules").send({ dayOfWeek: "MONDAY", subjectName: "수업", startTime: "12:00", endTime: "13:00", classroom: null });
    const response = await client.put("/api/v1/me/availability").send({ preferredSlots: [{ dayOfWeek: "MONDAY", startTime: "11:00", endTime: "12:00" }, { dayOfWeek: "MONDAY", startTime: "12:00", endTime: "14:00" }] });
    expect(response.status).toBe(200);
    expect(response.body.data.preferredSlots).toEqual([{ dayOfWeek: "MONDAY", startTime: "11:00", endTime: "14:00" }]);
    expect(response.body.data.effectiveSlots).toEqual([{ dayOfWeek: "MONDAY", startTime: "11:00", endTime: "12:00", durationMinutes: 60 }, { dayOfWeek: "MONDAY", startTime: "13:00", endTime: "14:00", durationMinutes: 60 }]);
  });

  it("updates and deletes only the current user's schedule", async () => {
    const client = authenticated();
    const created = await client.post("/api/v1/me/schedules").send({ dayOfWeek: "TUESDAY", subjectName: "수업", startTime: "11:00", endTime: "12:00", classroom: "101" });
    const scheduleId = created.body.data.id;
    const updated = await client.patch(`/api/v1/me/schedules/${scheduleId}`).send({ startTime: "12:00", endTime: "13:00", classroom: null });
    expect(updated.body.data).toMatchObject({ startTime: "12:00", endTime: "13:00", classroom: null });
    await client.delete(`/api/v1/me/schedules/${scheduleId}`).expect(204);
    const schedules = await client.get("/api/v1/me/schedules");
    expect(schedules.body.data).toEqual([]);
  });
});
