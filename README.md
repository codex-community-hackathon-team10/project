# Campus Mate

공강 기반 캠퍼스 점심 메이트 서비스입니다.

- 백엔드 실행: [`backend/README.md`](./backend/README.md)
- API 계약: [`docs/api/README.md`](./docs/api/README.md)
- 백엔드 병렬 개발 가이드: [`docs/backend/README.md`](./docs/backend/README.md)
- 프론트엔드 구현 가이드: [`docs/FRONTEND_IMPLEMENTATION_GUIDE.md`](./docs/FRONTEND_IMPLEMENTATION_GUIDE.md)

## 통합 배포

루트 Compose가 프론트엔드, 백엔드, PostgreSQL을 함께 실행한다.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up -d --build
```
