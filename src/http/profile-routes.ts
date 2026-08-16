import { Router } from "express";
import { z } from "zod";
import { ACTIVITIES, INTERESTS, MINIMUM_MEETING_MINUTES, STUDENT_TYPES, type Profile } from "../domain/types.js";
import { now, type MemoryStore } from "../store.js";
import { currentUserId } from "./auth.js";
import { ApiError, asyncRoute } from "./errors.js";

const profileInput = z.object({
  schoolId: z.string().min(1), campusId: z.string().min(1), nickname: z.string(), major: z.string().trim().min(1).max(100), grade: z.enum(["1", "2", "3", "4", "OTHER"]),
  studentType: z.enum(STUDENT_TYPES), activities: z.array(z.enum(ACTIVITIES)).min(1), interests: z.array(z.enum(INTERESTS)).min(1).max(10),
  languages: z.object({ speaks: z.array(z.string().min(1).max(10)).max(10), learning: z.array(z.string().min(1).max(10)).max(10) })
});
const preferenceInput = z.object({ isDiscoverable: z.boolean(), minimumMeetingMinutes: z.union(MINIMUM_MEETING_MINUTES.map((value) => z.literal(value)) as [z.ZodLiteral<30>, z.ZodLiteral<60>, z.ZodLiteral<90>, z.ZodLiteral<120>]) });

function profileResponse(store: MemoryStore, profile: Profile) {
  const school = store.getSchool(profile.schoolId)!;
  const campus = store.getCampus(profile.campusId)!;
  return { userId: profile.userId, school: { id: school.id, name: school.name }, campus: { id: campus.id, name: campus.name }, nickname: profile.nickname, major: profile.major, grade: profile.grade, studentType: profile.studentType, activities: profile.activities, interests: profile.interests, languages: profile.languages, isComplete: true, updatedAt: profile.updatedAt };
}

export function createProfileRouter(store: MemoryStore): Router {
  const router = Router();
  router.get("/schools", (_request, response) => response.json({ data: store.schools.map(({ id, name }) => ({ id, name })) }));
  router.get("/schools/:schoolId/campuses", (request, response) => {
    if (!store.getSchool(request.params.schoolId)) throw new ApiError(404, "SCHOOL_NOT_FOUND", "학교를 찾을 수 없습니다.");
    response.json({ data: store.campusesForSchool(request.params.schoolId).map(({ id, schoolId, name, timeZone }) => ({ id, schoolId, name, timeZone })) });
  });
  router.get("/profile-options", (_request, response) => response.json({ data: { grades: ["1", "2", "3", "4", "OTHER"], studentTypes: STUDENT_TYPES, activities: ACTIVITIES, interests: INTERESTS, minimumMeetingMinutes: MINIMUM_MEETING_MINUTES } }));
  router.get("/me/profile", (request, response) => {
    const profile = store.getProfile(currentUserId(request));
    if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "프로필을 찾을 수 없습니다.");
    response.json({ data: profileResponse(store, profile) });
  });
  router.put("/me/profile", asyncRoute((request, response) => {
    const userId = currentUserId(request);
    const input = profileInput.parse(request.body);
    const nickname = input.nickname.trim();
    if (nickname.length < 2 || nickname.length > 20) throw new ApiError(422, "VALIDATION_ERROR", "입력값을 확인해 주세요.", [{ field: "nickname", reason: "닉네임은 2~20자여야 합니다." }]);
    const campus = store.getCampus(input.campusId);
    if (!store.getSchool(input.schoolId) || !campus || campus.schoolId !== input.schoolId) throw new ApiError(422, "INVALID_SCHOOL_CAMPUS", "학교와 캠퍼스 관계가 유효하지 않습니다.");
    if (!input.activities.includes("LUNCH")) throw new ApiError(422, "VALIDATION_ERROR", "입력값을 확인해 주세요.", [{ field: "activities", reason: "LUNCH 활동은 필수입니다." }]);
    if (input.activities.includes("LANGUAGE_EXCHANGE") && input.languages.speaks.length + input.languages.learning.length === 0) throw new ApiError(422, "VALIDATION_ERROR", "입력값을 확인해 주세요.", [{ field: "languages", reason: "언어교환 활동에는 언어 정보가 필요합니다." }]);
    if (store.nicknameTaken(nickname, userId)) throw new ApiError(409, "NICKNAME_ALREADY_EXISTS", "이미 사용 중인 닉네임입니다.");
    const profile = store.saveProfile({ ...input, nickname, userId, updatedAt: now() });
    response.json({ data: profileResponse(store, profile) });
  }));
  router.get("/me/match-preferences", (request, response) => { const { userId: _userId, ...preference } = store.getPreference(currentUserId(request)); response.json({ data: preference }); });
  router.put("/me/match-preferences", (request, response) => { const input = preferenceInput.parse(request.body); const { userId: _userId, ...preference } = store.savePreference({ ...input, userId: currentUserId(request), updatedAt: now() }); response.json({ data: preference }); });
  return router;
}
