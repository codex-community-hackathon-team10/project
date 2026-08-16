import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required. Run npm run migrate first.");
const pool = new Pool({ connectionString: databaseUrl });
await pool.query("INSERT INTO schools (id,name) VALUES ('school_yonsei','연세대학교') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name");
await pool.query("INSERT INTO campuses (id,school_id,name) VALUES ('campus_yonsei_sinchon','school_yonsei','신촌캠퍼스') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name");
await pool.query("INSERT INTO users (id) VALUES ('user_a'),('user_b'),('user_c') ON CONFLICT (id) DO NOTHING");
await pool.end();
console.info("Seed complete.");
