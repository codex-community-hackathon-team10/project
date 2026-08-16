import { mkdir } from "node:fs/promises";

// HACK: P0 uses the in-memory adapter. Keeping this command makes replacing it
// with the shared production database migration a single script change.
await mkdir("data", { recursive: true });
console.info("Migration complete (demo in-memory schema).");
