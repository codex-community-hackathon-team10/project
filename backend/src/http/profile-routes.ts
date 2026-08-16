import { Router } from "express";
import { z } from "zod";
import { ACTIVITIES, INTERESTS, MINIMUM_MEETING_MINUTES, STUDENT_TYPES, type Profile } from "../domain/types.js";
import { now, type CoreStore } from "../store.js";
import { currentUserId } from "./auth.js";
import { ApiError, asyncRoute } from "./errors.js";

const profileInput = z.object({
  schoolId: z.string().min(1), campusId: z.string().min(1), nickname: z.string(), major: z.string().trim().min(1).max(100), grade: z.enum(["1", "2", "3", "4", "OTHER"]),
  studentType: z.enum(STUDENT_TYPES), activities: z.array(z.enum(ACTIVITIES)).min(1), interests: z.array(z.enum(INTERESTS)).min(1).max(10),
  languages: z.object({ speaks: z.array(z.string().min(1).max(10)).max(10), learning: z.array(z.string().min(1).max(10)).max(10) })
});
const preferenceInput = z.object({ isDiscoverable: z.boolean(), minimumMeetingMinutes: z.union(MINIMUM_MEETING_MINUTES.map((value) => z.literal(value)) as [z.ZodLiteral<30>, z.ZodLiteral<60>, z.ZodLiteral<90>, z.ZodLiteral<120>]) });

async function profileResponse(store: CoreStore, profile: Profile) {
  const school = await store.getSchool(profile.schoolId);
  const campus = await store.getCampus(profile.campusId);
  if (!school || !campus) throw new ApiError(422, "INVALID_SCHOOL_CAMPUS", "학교와 캠퍼스 관계가 유효하지 않습니다.");
  return { userId: profile.userId, school: { id: school.id, name: school.name }, campus: { id: campus.id, name: campus.name }, nickname: profile.nickname, major: profile.major, grade: profile.grade, studentType: profile.studentType, activities: profile.activities, interests: profile.interests, languages: profile.languages, isComplete: true, updatedAt: profile.updatedAt };
}

export function createProfileRouter(store: CoreStore): Router {
  const router = Router();
  router.get("/schools", asyncRoute(async (_request, response) => response.json({ data: (await store.listSchools()).map(({ id, name }) => ({ id, name })) })));
  router.get("/schools/:schoolId/campuses", asyncRoute(async (request, response) => {
    const schoolId = String(request.params.schoolId);
    if (!await store.getSchool(schoolId)) throw new ApiError(404, "SCHOOL_NOT_FOUND", "학교를 찾을 수 없습니다.");
    response.json({ data: (await store.campusesForSchool(schoolId)).map(({ id, schoolId: campusSchoolId, name, timeZone }) => ({ id, schoolId: campusSchoolId, name, timeZone })) });
  }));
  router.get("/profile-options", (_request, response) => response.json({ data: { grades: ["1", "2", "3", "4", "OTHER"], studentTypes: STUDENT_TYPES, activities: ACTIVITIES, interests: INTERESTS, minimumMeetingMinutes: MINIMUM_MEETING_MINUTES } }));
  router.get("/me/profile", asyncRoute(async (request, response) => {
    const profile = await store.getProfile(currentUserId(request));
    if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "프로필을 찾을 수 없습니다.");
    response.json({ data: await profileResponse(store, profile) });
  }));
  router.put("/me/profile", asyncRoute(async (request, response) => {
    const userId = currentUserId(request);
    const input = profileInput.parse(request.body);
    const nickname = input.nickname.trim();
    if (nickname.length < 2 || nickname.length > 20) throw new ApiError(422, "VALIDATION_ERROR", "입력값을 확인해 주세요.", [{ field: "nickname", reason: "닉네임은 2~20자여야 합니다." }]);
    const campus = await store.getCampus(input.campusId);
    if (!await store.getSchool(input.schoolId) || !campus || campus.schoolId !== input.schoolId) throw new ApiError(422, "INVALID_SCHOOL_CAMPUS", "학교와 캠퍼스 관계가 유효하지 않습니다.");
    if (!input.activities.includes("LUNCH")) throw new ApiError(422, "VALIDATION_ERROR", "입력값을 확인해 주세요.", [{ field: "activities", reason: "LUNCH 활동은 필수입니다." }]);
    if (input.activities.includes("LANGUAGE_EXCHANGE") && input.languages.speaks.length + input.languages.learning.length === 0) throw new ApiError(422, "VALIDATION_ERROR", "입력값을 확인해 주세요.", [{ field: "languages", reason: "언어교환 활동에는 언어 정보가 필요합니다." }]);
    if (await store.nicknameTaken(nickname, userId)) throw new ApiError(409, "NICKNAME_ALREADY_EXISTS", "이미 사용 중인 닉네임입니다.");
    const profile = await store.saveProfile({ ...input, nickname, userId, updatedAt: now() });
    response.json({ data: await profileResponse(store, profile) });
  }));
  router.get("/me/match-preferences", asyncRoute(async (request, response) => { const { userId: _userId, ...preference } = await store.getPreference(currentUserId(request)); response.json({ data: preference }); }));
  router.put("/me/match-preferences", asyncRoute(async (request, response) => { const input = preferenceInput.parse(request.body); const { userId: _userId, ...preference } = await store.savePreference({ ...input, userId: currentUserId(request), updatedAt: now() }); response.json({ data: preference }); }));
  return router;
}
