import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required. Start PostgreSQL with docker compose up -d.");
const pool = new Pool({ connectionString: databaseUrl });
try {
  const migrationFiles = (await readdir("db/migrations")).filter((file) => file.endsWith(".sql")).toSorted();
  for (const file of migrationFiles) await pool.query(await readFile(`db/migrations/${file}`, "utf8"));
} finally {
  await pool.end();
}
console.info("Migration complete.");
