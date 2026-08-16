import { describe, expect, it } from "vitest";
import { FakeCoreQueryPort } from "../src/fake-core-query-port.js";

describe("FakeCoreQueryPort", () => {
  it("only exposes discoverable active same-campus users", async () => {
    const port = new FakeCoreQueryPort([
      { userId: "user_a", nickname: "A", grade: "1", schoolId: "school", campusId: "campus", campusName: "캠퍼스", activities: ["LUNCH"], interests: [], languages: { speaks: [], learning: [] }, isDiscoverable: true, minimumMeetingMinutes: 60, isActive: true },
      { userId: "user_hidden", nickname: "H", grade: "1", schoolId: "school", campusId: "campus", campusName: "캠퍼스", activities: ["LUNCH"], interests: [], languages: { speaks: [], learning: [] }, isDiscoverable: false, minimumMeetingMinutes: 60, isActive: true }
    ]);

    await expect(port.listDiscoverableCampusUsers("campus", "user_a")).resolves.toEqual([]);
  });
});
