import { mkdir, writeFile } from "node:fs/promises";

await mkdir("data", { recursive: true });
await writeFile("data/seed.json", JSON.stringify({
  schools: [{ id: "school_yonsei", name: "연세대학교" }],
  campuses: [{ id: "campus_yonsei_sinchon", schoolId: "school_yonsei", name: "신촌캠퍼스" }],
  // HACK: demo identities correspond to the DemoTokenVerifier tokens.
  users: ["user_a", "user_b", "user_c"]
}, null, 2));
console.info("Seed complete.");
