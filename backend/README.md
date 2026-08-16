# Lunch Mate backend

모든 명령은 저장소의 `backend/` 디렉터리에서 실행한다.

## Local database

```bash
cd backend
cp .env.example .env
docker compose up -d
export DATABASE_URL=postgres://lunch_mate:lunch_mate_dev@localhost:5432/lunch_mate
npm run migrate
npm run seed
npm start
```

테스트는 외부 DB 없이 인메모리 저장소를 사용한다. 로컬 API 데모 인증 헤더는 `Authorization: Bearer demo:user_a` 형식이다.
