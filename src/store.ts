import { randomUUID } from "node:crypto";
import type { Campus, MatchPreference, PreferredSlot, Profile, Schedule, School, User } from "./domain/types.js";

export type StoreData = { users: User[]; schools: School[]; campuses: Campus[]; profiles: Profile[]; preferences: MatchPreference[]; schedules: Schedule[]; availability: Record<string, PreferredSlot[]>; availabilityUpdatedAt: Record<string, string> };

export const now = (): string => new Date().toISOString();

export class MemoryStore {
  private data: StoreData;

  constructor(initial: Partial<StoreData> = {}) {
    this.data = { users: [], schools: [], campuses: [], profiles: [], preferences: [], schedules: [], availability: {}, availabilityUpdatedAt: {}, ...initial };
  }

  async ensureUser(userId: string): Promise<User> {
    const existing = this.data.users.find((user) => user.id === userId);
    if (existing) return existing;
    const user = { id: userId, isActive: true };
    this.data = { ...this.data, users: [...this.data.users, user] };
    return user;
  }

  async listSchools(): Promise<School[]> { return this.data.schools.filter((school) => school.isActive); }
  async campusesForSchool(schoolId: string): Promise<Campus[]> { return this.data.campuses.filter((campus) => campus.schoolId === schoolId && campus.isActive); }
  async getSchool(schoolId: string): Promise<School | undefined> { return this.data.schools.find((school) => school.id === schoolId && school.isActive); }
  async getCampus(campusId: string): Promise<Campus | undefined> { return this.data.campuses.find((campus) => campus.id === campusId && campus.isActive); }
  async getProfile(userId: string): Promise<Profile | undefined> { return this.data.profiles.find((profile) => profile.userId === userId); }
  async saveProfile(profile: Profile): Promise<Profile> { await this.ensureUser(profile.userId); this.data = { ...this.data, profiles: [...this.data.profiles.filter((item) => item.userId !== profile.userId), profile] }; return profile; }
  async nicknameTaken(nickname: string, exceptUserId: string): Promise<boolean> { return this.data.profiles.some((profile) => profile.userId !== exceptUserId && profile.nickname === nickname); }
  async getPreference(userId: string): Promise<MatchPreference> { return this.data.preferences.find((item) => item.userId === userId) ?? { userId, isDiscoverable: true, minimumMeetingMinutes: 60, updatedAt: now() }; }
  async savePreference(preference: MatchPreference): Promise<MatchPreference> { await this.ensureUser(preference.userId); this.data = { ...this.data, preferences: [...this.data.preferences.filter((item) => item.userId !== preference.userId), preference] }; return preference; }
  async listSchedules(userId: string): Promise<Schedule[]> { return this.data.schedules.filter((schedule) => schedule.userId === userId).toSorted((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id)); }
  async createSchedule(schedule: Omit<Schedule, "id" | "createdAt" | "updatedAt">): Promise<Schedule> { await this.ensureUser(schedule.userId); const timestamp = now(); const result = { ...schedule, id: `schedule_${randomUUID()}`, createdAt: timestamp, updatedAt: timestamp }; this.data = { ...this.data, schedules: [...this.data.schedules, result] }; return result; }
  async updateSchedule(scheduleId: string, update: Partial<Omit<Schedule, "id" | "userId" | "createdAt" | "updatedAt">>): Promise<Schedule | undefined> { const current = this.data.schedules.find((item) => item.id === scheduleId); if (!current) return undefined; const result = { ...current, ...update, updatedAt: now() }; this.data = { ...this.data, schedules: this.data.schedules.map((item) => item.id === scheduleId ? result : item) }; return result; }
  async deleteSchedule(scheduleId: string): Promise<boolean> { const previousLength = this.data.schedules.length; this.data = { ...this.data, schedules: this.data.schedules.filter((item) => item.id !== scheduleId) }; return previousLength !== this.data.schedules.length; }
  async getAvailability(userId: string): Promise<PreferredSlot[]> { return this.data.availability[userId] ?? []; }
  async getAvailabilityUpdatedAt(userId: string): Promise<string> { return this.data.availabilityUpdatedAt[userId] ?? now(); }
  async saveAvailability(userId: string, slots: PreferredSlot[]): Promise<PreferredSlot[]> { await this.ensureUser(userId); this.data = { ...this.data, availability: { ...this.data.availability, [userId]: slots }, availabilityUpdatedAt: { ...this.data.availabilityUpdatedAt, [userId]: now() } }; return slots; }
  async getUser(userId: string): Promise<User | undefined> { return this.data.users.find((user) => user.id === userId); }
  async listProfilesAtCampus(campusId: string): Promise<Profile[]> { return this.data.profiles.filter((profile) => profile.campusId === campusId); }
}

export function createSeedStore(): MemoryStore {
  return new MemoryStore({ schools: [{ id: "school_yonsei", name: "연세대학교", isActive: true }], campuses: [{ id: "campus_yonsei_sinchon", schoolId: "school_yonsei", name: "신촌캠퍼스", timeZone: "Asia/Seoul", isActive: true }] });
}

export type CoreStore = Pick<MemoryStore, "ensureUser" | "listSchools" | "campusesForSchool" | "getSchool" | "getCampus" | "getProfile" | "saveProfile" | "nicknameTaken" | "getPreference" | "savePreference" | "listSchedules" | "createSchedule" | "updateSchedule" | "deleteSchedule" | "getAvailability" | "getAvailabilityUpdatedAt" | "saveAvailability" | "getUser" | "listProfilesAtCampus">;
