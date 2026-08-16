# Lunch Mate 프론트엔드 구현 가이드

## 준비 상태

- 시작 구조: React + TypeScript + Vite (`frontend/`)
- API 기준: `docs/api/00-common.md`와 기능별 API 문서
- 인증: 외부 인증 SDK가 발급한 access token을 `setAccessToken()`에 전달하는 방식으로 분리
- 로컬 화면 점검: `.env`에 `VITE_USE_MOCK_API=true`를 두면 백엔드 없이 추천 화면을 확인 가능

## 화면과 API 매핑

| 화면 | 핵심 사용자 행동 | API |
|---|---|---|
| 로그인/로그아웃 | 인증 공급자로 인증 | 외부 Auth SDK, 이후 Bearer token 주입 |
| 온보딩/프로필 | 학교·캠퍼스·관심사 저장 | `GET /schools`, `GET /schools/:id/campuses`, `GET /profile-options`, `GET/PUT /me/profile` |
| 시간표 | 수업 CRUD, 공강 확인 | `GET/POST /me/schedules`, `PATCH/DELETE /me/schedules/:id`, `GET /me/free-times` |
| 선호 시간/매칭 설정 | 선호 구간·발견 허용·최소 시간 저장 | `GET/PUT /me/availability`, `GET/PUT /me/match-preferences` |
| 메이트 탐색 | 추천 목록과 빈 상태 표시 | `GET /matches` (cursor 페이지네이션) |
| 점심 제안 | 날짜·시간·장소 선택 후 전송 | `GET /venues/recommendations`, `POST /meeting-proposals` |
| 받은/보낸 제안, 약속 | 필터, 수락·거절·취소 | `GET /meeting-proposals`, `PATCH /meeting-proposals/:id/status` |

## P0 라우트 제안

```text
/login
/onboarding/profile
/onboarding/schedule
/onboarding/availability
/matches
/matches/:userId/proposal
/proposals?tab=received|sent|appointments
/settings/profile
/settings/matching
```

## 반드시 반영할 UX 규칙

- 시간은 KST, 월~금, 11:00~15:00, 30분 단위다. 구간은 `[start, end)`이다.
- 추천 카드에는 상대의 전체 시간표·개인 연락처·학과를 노출하지 않는다.
- 추천 결과가 비면 서버 `meta.suggestions`를 우선 노출한다.
- 제안 생성과 수락은 `409` 충돌이 정상적인 사용 흐름이다. 최신 공통 시간을 다시 보여 주고 재선택하게 한다.
- 장소 결과가 비어도 직접 입력 장소(2~50자)로 제안을 계속할 수 있다.
- 제안 상태 변경 뒤 목록을 재조회한다. P0는 실시간 알림 대상이 아니다.

## 구현 순서

1. 인증 공급자 확정 후 로그인 가드와 `setAccessToken()` 연결
2. 프로필·시간표·선호 시간 온보딩 완성 및 `409 PROFILE_INCOMPLETE`, `409 NO_EFFECTIVE_AVAILABILITY` 처리
3. 추천 목록 cursor 무한 로드와 빈 상태
4. 제안 작성 단계(시간 → 장소 추천/직접입력 → 확인) 및 충돌 복구
5. 제안함 필터와 상태 변경, 접근성·모바일 검수

## 실행

```bash
Copy-Item .env.example .env
docker compose up --build
```

브라우저에서 `http://localhost:5173`을 엽니다. 종료는 `docker compose down`입니다.

실제 백엔드를 연결할 때는 `.env`의 `VITE_USE_MOCK_API=false`와 `VITE_API_ORIGIN`을 설정하고 컨테이너를 다시 시작합니다. 현재 백엔드 구현물이 없으므로, base URL과 포트는 백엔드 시작 시 확정합니다.
