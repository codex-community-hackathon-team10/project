import { mkdir, writeFile } from "node:fs/promises";

await mkdir("data", { recursive: true });
await writeFile("data/seed.json", JSON.stringify({ schools: ["school_yonsei"], campuses: ["campus_yonsei_sinchon"] }, null, 2));
console.info("Seed complete.");
