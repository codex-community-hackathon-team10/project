# 백엔드 2인 병렬 개발 가이드

> 기준 시각: 2026-08-16 14:29 KST
> 기능 개발 동결: 16:00 KST
> 대상 브랜치: `project/backend`
> 기준 계약: [`../api/README.md`](../api/README.md)

## 1. 목표

두 명이 서로 다른 모듈을 동시에 구현하고 합쳤을 때 다음 P0 데모 경로가 완성되어야 한다.

```text
데모 로그인
→ 최소 프로필
→ 주간 수업 전체 저장
→ 공강·선호 시간 계산
→ 메이트 추천
→ 장소 최대 3개 추천
→ 만남 제안
→ 상대 수락
→ ACCEPTED 제안 조회
```

## 2. 역할 요약

| 역할 | 책임 | 상세 문서 |
|---|---|---|
| Backend A — Core & Availability | 프로젝트 뼈대, 공통 오류·인증, 기준 데이터, 프로필, 시간표, 공강, 선호 시간, 최소 차단 | [01-backend-a-core.md](./01-backend-a-core.md) |
| Backend B — Match & Meeting | 매칭 점수, 장소 추천, 제안 생성·조회·수락, 날짜·확정 제안 충돌 | [02-backend-b-match.md](./02-backend-b-match.md) |
| 공동 | 초기 계약 동결, DB 결합, 통합 테스트, 데모 데이터 | [03-integration-runbook.md](./03-integration-runbook.md) |

역할은 endpoint 개수가 아니라 난이도와 변경 충돌을 기준으로 나눴다. A는 공통 기반과 시간 계산을, B는 이를 소비하는 추천·약속 흐름을 소유한다.

## 3. 브랜치 전략

두 사람 모두 최신 `backend`에서 시작한다.

```bash
git switch backend
git pull --ff-only origin backend
```

권장 작업 브랜치:

```text
Backend A: feat/be-core-availability
Backend B: feat/be-match-meeting
```

- 각자 자신의 브랜치에만 커밋한다.
- PR 대상은 `backend`다.
- A의 뼈대 커밋을 먼저 `backend`에 합친다.
- B는 A의 뼈대가 합쳐지면 한 번 rebase하고 자신의 모듈을 연결한다.
- 두 사람이 같은 파일을 동시에 수정하지 않는다.
- 커밋은 `feat: ...`, `fix: ...`, `test: ...`, `chore: ...` 형식을 사용한다.

## 4. 권장 모듈 경계

프레임워크에 맞게 실제 패키지 경로는 조정할 수 있지만 소유권은 유지한다.

```text
backend/
├── src/
│   ├── common/          # A
│   ├── auth/            # A
│   ├── reference/       # A
│   ├── profile/         # A
│   ├── schedule/        # A
│   ├── availability/    # A
│   ├── block/           # A
│   ├── match/           # B
│   ├── place/           # B
│   └── proposal/        # B
├── db/
│   ├── migrations/
│   │   ├── 001_core_*       # A
│   │   └── 002_meeting_*    # B
│   └── seeds/
│       ├── core-*           # A
│       └── places-*         # B
└── tests/
    ├── core-*           # A
    ├── match-*          # B
    └── e2e-*            # 공동
```

단일 schema 파일을 사용하는 ORM이라면 두 사람이 동시에 수정하지 않는다. A가 schema 파일 소유자이고 B는 필요한 `Place`, `MeetingProposal` 필드 목록을 A에게 전달한다. A가 먼저 빈 모델까지 추가한 뒤 B가 해당 모델을 사용한다.

## 5. 파일 소유권

| 영역 | 소유자 | 다른 사람의 수정 규칙 |
|---|---|---|
| 빌드·의존성·애플리케이션 시작점 | A | B는 필요한 의존성을 메시지로 요청 |
| 공통 응답·오류·인증 middleware | A | B는 import만 사용 |
| 사용자·시간표·선호·차단 모델 | A | B는 repository/service 계약만 사용 |
| 장소·제안 모델 | B | A는 직접 수정하지 않음 |
| 매칭·장소 점수 | B | A는 호출 결과만 사용 |
| 공통 API 문서 | 동결 | 구현 중 임의 변경 금지 |
| 통합 테스트·데모 seed 연결 | 공동 | 페어로 수정 |

## 6. P0만 구현한다

### 지금 구현

- 데모 계정 로그인과 내 정보
- 학교·캠퍼스·선택지
- 최소 프로필 GET/PUT
- 수업 목록 GET/PUT과 공강 GET
- 선호 시간 GET/PUT
- 차단 POST
- 매칭 목록·상세 GET
- 장소 추천 GET
- 제안 POST/GET, 제안 상세 GET, 수락 POST

### 지금 구현하지 않음

- 공개 회원가입, Refresh Token, 비밀번호 재설정
- 개별 수업 POST/PATCH/DELETE
- OCR
- 관심·넘기기
- 제안 거절·취소
- 차단 목록·해제, 신고
- 실제 지도·영업시간·웨이팅 API
- 별도 Appointment 테이블과 `/appointments` API

## 7. 공동으로 먼저 동결할 계약

작업 시작 후 10분 안에 다음 이름과 타입을 합의하고 바꾸지 않는다.

```text
UserId: string
DayOfWeek: MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY
Time: HH:mm
VerificationStatus: DEMO_VERIFIED | SCHOOL_EMAIL_VERIFIED | UNVERIFIED
ProposalStatus: PENDING | ACCEPTED | REJECTED | CANCELED
TimeSlot: dayOfWeek, startTime, endTime, durationMinutes
```

A가 B에게 제공해야 하는 최소 port:

```ts
interface CoreQueryPort {
  getVerifiedUser(userId: string): Promise<UserMatchProjection>;
  getEffectiveSlots(userId: string): Promise<TimeSlot[]>;
  isBlocked(userId: string, targetUserId: string): Promise<boolean>;
  listCampusCandidates(campusId: string, excludeUserId: string): Promise<UserMatchProjection[]>;
}
```

언어가 TypeScript가 아니면 동일 의미의 interface/protocol로 작성한다.

## 8. 시간 계획

현재 시각 기준 권장 계획이다.

| 시간 | A | B | 공동 결과 |
|---|---|---|---|
| 14:30~14:40 | 프로젝트 뼈대·공통 타입 | 점수 함수와 DTO를 독립 작성 | 타입·상태·경로 동결 |
| 14:40~15:20 | 인증→프로필→시간표→선호 | 매칭→장소→제안 service | 각 모듈 단위 테스트 |
| 15:20~15:40 | core seed·port 완성 | repository 연결·충돌 검사 | 첫 통합 실행 |
| 15:40~16:00 | API 응답·오류 수정 | 데모 경로 오류 수정 | P0 smoke test 통과 |
| 16:00 이후 | 신규 기능 금지 | 신규 기능 금지 | 리허설·버그 수정만 |

## 9. 완료 정의

다음 항목이 모두 충족돼야 백엔드 P0 완료다.

- 애플리케이션을 README 한 번의 명령으로 실행할 수 있다.
- demo seed가 멱등적으로 입력된다.
- API 응답과 오류가 `docs/api` 계약을 따른다.
- 공강과 선호 시간의 교집합이 서버에서 계산된다.
- 차단 관계와 미인증 사용자가 추천에서 제외된다.
- 장소 추천은 seed 후보 최대 3개만 반환한다.
- 제안 생성과 수락 양쪽에서 확정 제안 충돌을 검사한다.
- 수락은 Proposal을 `ACCEPTED`로만 변경하고 Appointment를 만들지 않는다.
- AI를 끄거나 호출하지 않아도 템플릿 추천 이유가 반환된다.
- 메인 데모 smoke test가 통과한다.
