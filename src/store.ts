import { randomUUID } from "node:crypto";
import type { Campus, MatchPreference, MeetingProposal, PreferredSlot, Profile, ProposalStatus, Schedule, School, User, Venue } from "./domain/types.js";

export type StoreData = {
  users: User[];
  schools: School[];
  campuses: Campus[];
  profiles: Profile[];
  preferences: MatchPreference[];
  schedules: Schedule[];
  availability: Record<string, PreferredSlot[]>;
  availabilityUpdatedAt: Record<string, string>;
  venues: Venue[];
  meetingProposals: MeetingProposal[];
};

export const now = (): string => new Date().toISOString();

export class MemoryStore {
  private data: StoreData;
  private readonly lockTails = new Map<string, Promise<void>>();

  constructor(initial: Partial<StoreData> = {}) {
    this.data = {
      users: [], schools: [], campuses: [], profiles: [], preferences: [], schedules: [], availability: {}, availabilityUpdatedAt: {}, venues: [], meetingProposals: [], ...initial
    };
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

  async listActiveVenues(campusId: string): Promise<Venue[]> { return this.data.venues.filter((venue) => venue.campusId === campusId && venue.isActive); }
  async getActiveVenue(venueId: string): Promise<Venue | undefined> { return this.data.venues.find((venue) => venue.id === venueId && venue.isActive); }
  async getMeetingProposal(proposalId: string): Promise<MeetingProposal | undefined> { return this.data.meetingProposals.find((proposal) => proposal.id === proposalId); }
  async listMeetingProposalsForUser(userId: string): Promise<MeetingProposal[]> { return this.data.meetingProposals.filter((proposal) => proposal.senderId === userId || proposal.receiverId === userId); }
  async createMeetingProposal(proposal: Omit<MeetingProposal, "id" | "createdAt">): Promise<MeetingProposal> {
    const result: MeetingProposal = { ...proposal, id: `proposal_${randomUUID()}`, createdAt: now() };
    this.data = { ...this.data, meetingProposals: [...this.data.meetingProposals, result] };
    return result;
  }
  async updateMeetingProposalStatus(proposalId: string, expectedStatus: ProposalStatus, update: Pick<MeetingProposal, "status" | "respondedAt" | "canceledBy">): Promise<MeetingProposal | undefined> {
    const current = await this.getMeetingProposal(proposalId);
    if (!current || current.status !== expectedStatus) return undefined;
    const result = { ...current, ...update };
    this.data = { ...this.data, meetingProposals: this.data.meetingProposals.map((proposal) => proposal.id === proposalId ? result : proposal) };
    return result;
  }

  async withUserLocks<T>(userIds: string[], operation: () => Promise<T> | T): Promise<T> {
    const locks: { key: string; queued: Promise<void>; release: () => void }[] = [];
    for (const key of [...new Set(userIds)].sort()) {
      const previous = this.lockTails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const queued = previous.then(() => gate);
      this.lockTails.set(key, queued);
      await previous;
      locks.push({ key, queued, release });
    }
    try {
      return await operation();
    } finally {
      for (const lock of locks.toReversed()) {
        lock.release();
        if (this.lockTails.get(lock.key) === lock.queued) this.lockTails.delete(lock.key);
      }
    }
  }
}

export type CoreStore = Pick<MemoryStore,
  "ensureUser" | "listSchools" | "campusesForSchool" | "getSchool" | "getCampus" | "getProfile" | "saveProfile" | "nicknameTaken" | "getPreference" | "savePreference" | "listSchedules" | "createSchedule" | "updateSchedule" | "deleteSchedule" | "getAvailability" | "getAvailabilityUpdatedAt" | "saveAvailability" | "getUser" | "listProfilesAtCampus"
>;

export type SocialStore = CoreStore & Pick<MemoryStore,
  "listActiveVenues" | "getActiveVenue" | "getMeetingProposal" | "listMeetingProposalsForUser" | "createMeetingProposal" | "updateMeetingProposalStatus" | "withUserLocks"
>;

export function createSeedStore(): MemoryStore {
  return new MemoryStore(seedStoreData());
}

export function seedStoreData(): StoreData {
  return {
    users: [],
    schools: [{ id: "school_yonsei", name: "연세대학교", isActive: true }],
    campuses: [{ id: "campus_yonsei_sinchon", schoolId: "school_yonsei", name: "신촌캠퍼스", timeZone: "Asia/Seoul", isActive: true }],
    profiles: [],
    preferences: [],
    schedules: [],
    availability: {},
    availabilityUpdatedAt: {},
    venues: [
      { id: "venue_student_hall", campusId: "campus_yonsei_sinchon", name: "학생회관 식당", category: "RESTAURANT", walkMinutes: 3, priceRange: "UNDER_10000", tags: ["QUICK_MEAL"], description: "캠퍼스 안에서 빠르게 식사할 수 있는 장소", isActive: true },
      { id: "venue_rice_bowl", campusId: "campus_yonsei_sinchon", name: "캠퍼스 앞 덮밥집", category: "RESTAURANT", walkMinutes: 6, priceRange: "UNDER_10000", tags: ["GOOD_FOR_TALKING"], description: "든든한 한 끼를 먹기 좋은 식당", isActive: true },
      { id: "venue_campus_cafe", campusId: "campus_yonsei_sinchon", name: "캠퍼스 카페", category: "CAFE", walkMinutes: 4, priceRange: "AROUND_15000", tags: ["GOOD_FOR_TALKING", "RELAXED"], description: "식사 후 대화하기 좋은 카페", isActive: true }
    ],
    meetingProposals: []
  };
}
