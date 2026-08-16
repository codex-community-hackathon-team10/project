# 백엔드 2인 병렬 개발 가이드

> 유일한 기능 정본: [`docs/funtiondalspec.md`](../funtiondalspec.md)
> API 계약: [`docs/api/README.md`](../api/README.md)
> 대상 브랜치: `backend`

## 역할

| 역할 | 책임 | 문서 |
|---|---|---|
| Backend A — Core Time | 서버 뼈대, 외부 인증 검증, 프로필, 매칭 선호, 수업 CRUD, 공강·선호 시간 | [01-backend-a.md](./01-backend-a.md) |
| Backend B — Social Flow | 매칭, 장소 추천, MeetingProposal 생성·조회·상태 변경 | [02-backend-b.md](./02-backend-b.md) |
| 공동 | DB 결합, seed, smoke test, 병합 | [03-integration.md](./03-integration.md) |

## 단방향 의존성

```text
Backend A가 제공
User/Profile + MatchPreference + EffectiveSlots
                 ↓
Backend B가 소비
Match + VenueRecommendation + MeetingProposal
```

B는 A의 시간표 테이블을 직접 조회하지 않고 `CoreQueryPort`를 사용한다.

```ts
interface CoreQueryPort {
  getUserMatchView(userId: string): Promise<UserMatchView>;
  listDiscoverableCampusUsers(campusId: string, excludeUserId: string): Promise<UserMatchView[]>;
  getEffectiveSlots(userId: string): Promise<TimeSlot[]>;
}
```

## 브랜치

```text
A: feat/be-core-time
B: feat/be-social-flow
PR target: backend
```

- A가 실행 가능한 skeleton을 먼저 짧게 커밋한다.
- B는 skeleton을 반영하고 자신의 모듈만 수정한다.
- A PR을 먼저 합친 뒤 B가 최신 `backend`를 rebase한다.
- 같은 파일을 동시에 수정하지 않는다.

## 소유권

| 파일·모듈 | 소유자 |
|---|---|
| root build/config, common, auth | A |
| reference, profile, match-preference | A |
| schedule, free-time, availability | A |
| match, venue, meeting-proposal | B |
| 단일 ORM schema 파일 | A, B는 모델 요구 전달 |
| e2e·seed 연결 | 공동 |

## P0 endpoint 분배

### A

- `GET /schools`
- `GET /schools/{schoolId}/campuses`
- `GET /profile-options`
- `GET/PUT /me/profile`
- `GET/PUT /me/match-preferences`
- `GET/POST /me/schedules`
- `PATCH/DELETE /me/schedules/{scheduleId}`
- `GET /me/free-times`
- `GET/PUT /me/availability`

### B

- `GET /matches`
- `GET /venues/recommendations`
- `POST /meeting-proposals`
- `GET /meeting-proposals`
- `PATCH /meeting-proposals/{proposalId}/status`

## 금지

- 자체 Access/Refresh Token 구현
- 차단·신고 P0 추가
- OCR·실시간 장소 API
- `LUNCH` 외 제안
- 별도 Appointment 테이블
- 정본과 다른 endpoint 임의 생성
