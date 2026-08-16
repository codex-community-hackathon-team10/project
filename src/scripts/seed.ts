import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required. Run npm run migrate first.");
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query("BEGIN");
  await pool.query("INSERT INTO schools (id,name) VALUES ('school_yonsei','연세대학교') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name");
  await pool.query("INSERT INTO campuses (id,school_id,name) VALUES ('campus_yonsei_sinchon','school_yonsei','신촌캠퍼스') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name");
  await pool.query("INSERT INTO users (id) VALUES ('user_a'),('user_b'),('user_c') ON CONFLICT (id) DO NOTHING");

  for (const [userId, nickname, interests] of [["user_a", "민지", ["MUSIC", "TRAVEL"]], ["user_b", "Alex", ["MUSIC", "FOOD"]], ["user_c", "지호", ["GAMES"]]] as const) {
    await pool.query("INSERT INTO profiles (user_id,school_id,campus_id,nickname,major,grade,student_type,activities,interests,languages,updated_at) VALUES ($1,'school_yonsei','campus_yonsei_sinchon',$2,'컴퓨터과학과','3','DOMESTIC',ARRAY['LUNCH'],$3,$4,NOW()) ON CONFLICT (user_id) DO UPDATE SET school_id=EXCLUDED.school_id,campus_id=EXCLUDED.campus_id,nickname=EXCLUDED.nickname,major=EXCLUDED.major,grade=EXCLUDED.grade,student_type=EXCLUDED.student_type,activities=EXCLUDED.activities,interests=EXCLUDED.interests,languages=EXCLUDED.languages,updated_at=EXCLUDED.updated_at", [userId, nickname, interests, JSON.stringify({ speaks: [], learning: [] })]);
    await pool.query("INSERT INTO match_preferences (user_id,is_discoverable,minimum_meeting_minutes,updated_at) VALUES ($1,true,60,NOW()) ON CONFLICT (user_id) DO UPDATE SET is_discoverable=EXCLUDED.is_discoverable,minimum_meeting_minutes=EXCLUDED.minimum_meeting_minutes,updated_at=EXCLUDED.updated_at", [userId]);
  }

  await pool.query("DELETE FROM availability_slots WHERE user_id IN ('user_a','user_b','user_c')");
  await pool.query("INSERT INTO availability_slots (user_id,day_of_week,start_time,end_time) VALUES ('user_a','MONDAY','12:00','14:00'),('user_b','MONDAY','12:00','13:30'),('user_c','MONDAY','11:00','12:00')");
  await pool.query("INSERT INTO availability_updates (user_id,updated_at) VALUES ('user_a',NOW()),('user_b',NOW()),('user_c',NOW()) ON CONFLICT (user_id) DO UPDATE SET updated_at=EXCLUDED.updated_at");

  for (const venue of [
    ["venue_student_hall", "학생회관 식당", "RESTAURANT", 3, "UNDER_10000", ["QUICK_MEAL"], "캠퍼스 안에서 빠르게 식사할 수 있는 장소"],
    ["venue_rice_bowl", "캠퍼스 앞 덮밥집", "RESTAURANT", 6, "UNDER_10000", ["GOOD_FOR_TALKING"], "든든한 한 끼를 먹기 좋은 식당"],
    ["venue_campus_cafe", "캠퍼스 카페", "CAFE", 4, "AROUND_15000", ["GOOD_FOR_TALKING", "RELAXED"], "식사 후 대화하기 좋은 카페"]
  ] as const) {
    const [id, name, category, walkMinutes, priceRange, tags, description] = venue;
    await pool.query("INSERT INTO venues (id,campus_id,name,category,walk_minutes,price_range,tags,description,is_active) VALUES ($1,'campus_yonsei_sinchon',$2,$3,$4,$5,$6,$7,true) ON CONFLICT (id) DO UPDATE SET campus_id=EXCLUDED.campus_id,name=EXCLUDED.name,category=EXCLUDED.category,walk_minutes=EXCLUDED.walk_minutes,price_range=EXCLUDED.price_range,tags=EXCLUDED.tags,description=EXCLUDED.description,is_active=true", [id, name, category, walkMinutes, priceRange, [...tags], description]);
  }
  await pool.query("COMMIT");
} catch (error) {
  await pool.query("ROLLBACK");
  throw error;
} finally {
  await pool.end();
}

console.info("Seed complete.");
