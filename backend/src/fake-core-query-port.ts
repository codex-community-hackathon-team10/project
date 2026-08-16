import type { CoreQueryPort } from "./domain/core-query-port.js";
import type { TimeSlot, UserMatchView } from "./domain/types.js";

/** B 모듈 단위 테스트용. 실제 서버에서는 StoreCoreQueryPort를 사용한다. */
export class FakeCoreQueryPort implements CoreQueryPort {
  constructor(private readonly users: UserMatchView[] = [], private readonly slotsByUserId = new Map<string, TimeSlot[]>()) {}

  async getUserMatchView(userId: string): Promise<UserMatchView> {
    const user = this.users.find((item) => item.userId === userId);
    if (!user) throw new Error(`Unknown fake user: ${userId}`);
    return structuredClone(user);
  }

  async listDiscoverableCampusUsers(campusId: string, excludeUserId: string): Promise<UserMatchView[]> {
    return this.users.filter((user) => user.campusId === campusId && user.userId !== excludeUserId && user.isDiscoverable && user.isActive).map((user) => structuredClone(user));
  }

  async getEffectiveSlots(userId: string): Promise<TimeSlot[]> {
    return structuredClone(this.slotsByUserId.get(userId) ?? []);
  }
}
