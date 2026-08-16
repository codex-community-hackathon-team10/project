import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required. Start PostgreSQL with docker compose up -d.");
const pool = new Pool({ connectionString: databaseUrl });
await pool.query(await readFile("db/migrations/001_core_time.sql", "utf8"));
await pool.end();
console.info("Migration complete.");
