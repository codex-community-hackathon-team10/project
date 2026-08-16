import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required. Run npm run migrate first.");
const pool = new Pool({ connectionString: databaseUrl });

const nicknames = ["민지", "Alex", "지호", "서연", "하준", "유나", "도윤", "수아", "현우", "지민", "준서", "채원", "시우", "예린", "민준", "다은", "건우", "나연", "우진", "소민", "정우", "가은", "태윤", "은서", "승민", "하윤", "재현", "보민", "성훈", "아린"];
const majors = ["컴퓨터과학과", "경영학과", "심리학과", "경제학과", "국어국문학과", "전기전자공학과", "사회학과", "생명공학과", "디자인학과", "정치외교학과"];
const interestPool = ["MUSIC", "TRAVEL", "MOVIES", "BOOKS", "GAMES", "SPORTS", "FOOD", "CULTURE", "TECH", "CAREER"];
const demoUsers = nicknames.map((nickname, index) => ({
  userId: index === 0 ? "user_a" : index === 1 ? "user_b" : index === 2 ? "user_c" : `demo_user_${String(index + 1).padStart(2, "0")}`,
  nickname,
  major: majors[index % majors.length],
  grade: String(index % 4 + 1),
  studentType: index % 7 === 0 ? "EXCHANGE" : index % 5 === 0 ? "INTERNATIONAL" : "DOMESTIC",
  activities: index % 4 === 0 ? ["LUNCH", "LANGUAGE_EXCHANGE"] : index % 3 === 0 ? ["LUNCH", "STUDY"] : ["LUNCH", "CAFE"],
  interests: [interestPool[index % interestPool.length], interestPool[(index + 3) % interestPool.length], interestPool[(index + 6) % interestPool.length]],
  languages: index % 4 === 0 ? { speaks: ["KO"], learning: ["EN"] } : { speaks: ["KO"], learning: [] },
  isDiscoverable: index % 10 !== 9,
  minimumMeetingMinutes: [30, 60, 60, 90][index % 4]
}));

try {
  await pool.query("BEGIN");
  await pool.query("INSERT INTO schools (id,name) VALUES ('school_yonsei','연세대학교') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name");
  await pool.query("INSERT INTO campuses (id,school_id,name) VALUES ('campus_yonsei_sinchon','school_yonsei','신촌캠퍼스') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name");
  const demoUserIds = demoUsers.map(({ userId }) => userId);
  for (const user of demoUsers) {
    await pool.query("INSERT INTO users (id,is_active) VALUES ($1,true) ON CONFLICT (id) DO UPDATE SET is_active=true", [user.userId]);
    await pool.query("INSERT INTO profiles (user_id,school_id,campus_id,nickname,major,grade,student_type,activities,interests,languages,updated_at) VALUES ($1,'school_yonsei','campus_yonsei_sinchon',$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT (user_id) DO UPDATE SET school_id=EXCLUDED.school_id,campus_id=EXCLUDED.campus_id,nickname=EXCLUDED.nickname,major=EXCLUDED.major,grade=EXCLUDED.grade,student_type=EXCLUDED.student_type,activities=EXCLUDED.activities,interests=EXCLUDED.interests,languages=EXCLUDED.languages,updated_at=EXCLUDED.updated_at", [user.userId, user.nickname, user.major, user.grade, user.studentType, user.activities, user.interests, JSON.stringify(user.languages)]);
    await pool.query("INSERT INTO match_preferences (user_id,is_discoverable,minimum_meeting_minutes,updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (user_id) DO UPDATE SET is_discoverable=EXCLUDED.is_discoverable,minimum_meeting_minutes=EXCLUDED.minimum_meeting_minutes,updated_at=EXCLUDED.updated_at", [user.userId, user.isDiscoverable, user.minimumMeetingMinutes]);
  }

  await pool.query("DELETE FROM availability_slots WHERE user_id = ANY($1::text[])", [demoUserIds]);
  await pool.query("DELETE FROM class_schedules WHERE user_id = ANY($1::text[])", [demoUserIds]);
  for (const [index, user] of demoUsers.entries()) {
    const secondDay = index % 2 === 0 ? "WEDNESDAY" : "THURSDAY";
    const secondStart = index % 3 === 0 ? "11:30" : "12:00";
    const secondEnd = index % 3 === 0 ? "13:30" : "14:00";
    await pool.query("INSERT INTO availability_slots (user_id,day_of_week,start_time,end_time) VALUES ($1,'MONDAY','12:00','14:00'),($1,$2,$3,$4)", [user.userId, secondDay, secondStart, secondEnd]);
    await pool.query("INSERT INTO availability_updates (user_id,updated_at) VALUES ($1,NOW()) ON CONFLICT (user_id) DO UPDATE SET updated_at=EXCLUDED.updated_at", [user.userId]);
    await pool.query("INSERT INTO class_schedules (id,user_id,day_of_week,subject_name,start_time,end_time,classroom,created_at,updated_at) VALUES ($1,$2,'MONDAY',$3,$4,$5,$6,NOW(),NOW())", [`seed_schedule_${String(index + 1).padStart(2, "0")}`, user.userId, `${user.major} 전공수업`, index % 2 === 0 ? "11:00" : "14:00", index % 2 === 0 ? "12:00" : "15:00", index % 3 === 0 ? "백양관" : null]);
  }

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
