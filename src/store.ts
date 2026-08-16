import { randomUUID } from "node:crypto";
import type { Campus, MatchPreference, PreferredSlot, Profile, Schedule, School, User } from "./domain/types.js";

export type StoreData = { users: User[]; schools: School[]; campuses: Campus[]; profiles: Profile[]; preferences: MatchPreference[]; schedules: Schedule[]; availability: Record<string, PreferredSlot[]> };

export const now = (): string => new Date().toISOString();

export class MemoryStore {
  private data: StoreData;

  constructor(initial: Partial<StoreData> = {}) {
    this.data = { users: [], schools: [], campuses: [], profiles: [], preferences: [], schedules: [], availability: {}, ...initial };
  }

  ensureUser(userId: string): User {
    const existing = this.data.users.find((user) => user.id === userId);
    if (existing) return existing;
    const user = { id: userId, isActive: true };
    this.data = { ...this.data, users: [...this.data.users, user] };
    return user;
  }

  get schools(): School[] { return this.data.schools.filter((school) => school.isActive); }
  campusesForSchool(schoolId: string): Campus[] { return this.data.campuses.filter((campus) => campus.schoolId === schoolId && campus.isActive); }
  getSchool(schoolId: string): School | undefined { return this.data.schools.find((school) => school.id === schoolId && school.isActive); }
  getCampus(campusId: string): Campus | undefined { return this.data.campuses.find((campus) => campus.id === campusId && campus.isActive); }
  getProfile(userId: string): Profile | undefined { return this.data.profiles.find((profile) => profile.userId === userId); }
  saveProfile(profile: Profile): Profile { this.ensureUser(profile.userId); this.data = { ...this.data, profiles: [...this.data.profiles.filter((item) => item.userId !== profile.userId), profile] }; return profile; }
  nicknameTaken(nickname: string, exceptUserId: string): boolean { return this.data.profiles.some((profile) => profile.userId !== exceptUserId && profile.nickname === nickname); }
  getPreference(userId: string): MatchPreference { return this.data.preferences.find((item) => item.userId === userId) ?? { userId, isDiscoverable: true, minimumMeetingMinutes: 60, updatedAt: now() }; }
  savePreference(preference: MatchPreference): MatchPreference { this.ensureUser(preference.userId); this.data = { ...this.data, preferences: [...this.data.preferences.filter((item) => item.userId !== preference.userId), preference] }; return preference; }
  listSchedules(userId: string): Schedule[] { return this.data.schedules.filter((schedule) => schedule.userId === userId).toSorted((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)); }
  createSchedule(schedule: Omit<Schedule, "id" | "createdAt" | "updatedAt">): Schedule { const timestamp = now(); const result = { ...schedule, id: `schedule_${randomUUID()}`, createdAt: timestamp, updatedAt: timestamp }; this.data = { ...this.data, schedules: [...this.data.schedules, result] }; return result; }
  updateSchedule(scheduleId: string, update: Partial<Omit<Schedule, "id" | "userId" | "createdAt" | "updatedAt">>): Schedule | undefined { const current = this.data.schedules.find((item) => item.id === scheduleId); if (!current) return undefined; const result = { ...current, ...update, updatedAt: now() }; this.data = { ...this.data, schedules: this.data.schedules.map((item) => item.id === scheduleId ? result : item) }; return result; }
  deleteSchedule(scheduleId: string): boolean { const previousLength = this.data.schedules.length; this.data = { ...this.data, schedules: this.data.schedules.filter((item) => item.id !== scheduleId) }; return previousLength !== this.data.schedules.length; }
  getAvailability(userId: string): PreferredSlot[] { return this.data.availability[userId] ?? []; }
  saveAvailability(userId: string, slots: PreferredSlot[]): PreferredSlot[] { this.ensureUser(userId); this.data = { ...this.data, availability: { ...this.data.availability, [userId]: slots } }; return slots; }
  getUser(userId: string): User | undefined { return this.data.users.find((user) => user.id === userId); }
  listProfilesAtCampus(campusId: string): Profile[] { return this.data.profiles.filter((profile) => profile.campusId === campusId); }
}

export function createSeedStore(): MemoryStore {
  return new MemoryStore({ schools: [{ id: "school_yonsei", name: "연세대학교", isActive: true }], campuses: [{ id: "campus_yonsei_sinchon", schoolId: "school_yonsei", name: "신촌캠퍼스", timeZone: "Asia/Seoul", isActive: true }] });
}
