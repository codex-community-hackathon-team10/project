import type { CoreQueryPort } from "./domain/core-query-port.js";
import { calculateEffectiveSlots, calculateFreeSlots } from "./domain/time.js";
import type { TimeSlot, UserMatchView } from "./domain/types.js";
import type { CoreStore } from "./store.js";
import { ApiError } from "./http/errors.js";

export class StoreCoreQueryPort implements CoreQueryPort {
  constructor(private readonly store: CoreStore) {}

  async getUserMatchView(userId: string): Promise<UserMatchView> {
    const profile = await this.store.getProfile(userId);
    const user = await this.store.getUser(userId);
    const campus = profile ? await this.store.getCampus(profile.campusId) : undefined;
    if (!profile || !user || !campus) throw new ApiError(404, "PROFILE_NOT_FOUND", "프로필을 찾을 수 없습니다.");
    const preference = await this.store.getPreference(userId);
    return { userId, nickname: profile.nickname, grade: profile.grade, schoolId: profile.schoolId, campusId: profile.campusId, campusName: campus.name, activities: [...profile.activities], interests: [...profile.interests], languages: { speaks: [...profile.languages.speaks], learning: [...profile.languages.learning] }, isDiscoverable: preference.isDiscoverable, minimumMeetingMinutes: preference.minimumMeetingMinutes, isActive: user.isActive };
  }

  async listDiscoverableCampusUsers(campusId: string, excludeUserId: string): Promise<UserMatchView[]> {
    const profiles = (await this.store.listProfilesAtCampus(campusId)).filter((profile) => profile.userId !== excludeUserId);
    const views = await Promise.all(profiles.map((profile) => this.getUserMatchView(profile.userId)));
    return views.filter((view) => view.isDiscoverable && view.isActive);
  }

  async getEffectiveSlots(userId: string): Promise<TimeSlot[]> {
    return calculateEffectiveSlots(calculateFreeSlots(await this.store.listSchedules(userId), 30), await this.store.getAvailability(userId));
  }
}
