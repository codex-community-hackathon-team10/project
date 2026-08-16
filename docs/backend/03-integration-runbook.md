# 백엔드 통합 런북

## 1. 목적

Backend A와 B의 결과를 안전하게 합치고 데모 경로를 검증한다. 기능을 더 만드는 문서가 아니라 병합 실패와 계약 불일치를 줄이는 문서다.

## 2. 시작 전 10분 공동 결정

저장소에 백엔드 스택이 아직 없으므로 다음을 한 번만 결정하고 README에 기록한다.

- 언어와 프레임워크
- 데이터베이스와 ORM
- 패키지 관리자와 실행 명령
- migration과 seed 명령
- 테스트 명령
- 로컬 포트와 CORS 허용 origin
- Access Token 서명 secret 환경변수 이름

10분 안에 합의하지 못하면 팀이 가장 익숙한 단일 스택을 선택한다. 새로운 프레임워크 학습을 시작하지 않는다.

## 3. 통합 순서

### Checkpoint 1 — 뼈대

1. A가 실행 가능한 skeleton을 커밋한다.
2. B가 해당 커밋을 rebase 또는 cherry-pick한다.
3. 둘 다 같은 테스트 명령을 실행한다.
4. 공통 타입과 오류 형식을 동결한다.

### Checkpoint 2 — 독립 모듈

- A: 로그인→프로필→시간표→공강→선호 시간
- B: fake port로 매칭→장소→제안 순수 로직

각자 단위 테스트가 통과하기 전 통합하지 않는다.

### Checkpoint 3 — 실제 repository 연결

1. A PR을 `backend`에 먼저 합친다.
2. B가 최신 `backend`를 rebase한다.
3. B의 fake CoreQueryPort를 실제 구현으로 교체한다.
4. B PR을 `backend`에 합친다.
5. 공동 smoke test를 실행한다.

## 4. 충돌 방지 규칙

- root build 파일, 공통 오류, 인증 middleware는 A만 수정한다.
- B가 의존성을 추가해야 하면 패키지명과 이유를 A에게 전달한다.
- 단일 ORM schema 파일은 A만 수정한다.
- B는 `Place`, `MeetingProposal` 필드 요청을 한 번에 전달한다.
- API 문서와 enum을 구현 중 즉흥적으로 바꾸지 않는다.
- 불가피한 계약 변경은 먼저 `docs/api` 수정안을 두 사람이 확인한다.

## 5. DB 결합 체크리스트

### Core migration — A

- users
- profiles
- schools, campuses
- classes
- availabilities, preferred slots
- blocks

### Meeting migration — B

- places
- meeting proposals

### 관계

- Proposal sender/receiver → User
- Proposal placeId → Place, nullable
- Block blocker/blocked → User
- Class/Availability/Profile → User

외래 키 삭제 정책은 P0에서 cascade를 남발하지 않는다. 데모 계정을 삭제하는 기능이 없으므로 명시적 삭제 정책은 P1로 미룬다.

## 6. 공통 API 계약 검사

모든 endpoint에서 확인한다.

- 성공 응답은 `{ "data": ... }`
- 오류 응답은 `{ "error": { "code", "message", "requestId" } }`
- 인증 누락은 `401`
- 입력 오류는 `422`
- 상태 충돌은 `409`
- 사용자 소유 리소스 위반은 정보 노출 없이 `404` 또는 명세의 `403`
- 빈 목록은 `[]`
- enum은 API 문서와 동일한 대문자 문자열

## 7. 데모 seed 계약

### 사용자 A

```text
campus: 신촌
verification: DEMO_VERIFIED
effective slot: MONDAY 12:00~14:00
activity: LUNCH
```

### 사용자 B

```text
campus: 신촌
verification: DEMO_VERIFIED
effective slot: MONDAY 12:00~13:30
activity: LUNCH
```

### 사용자 C

다른 캠퍼스 또는 공통 시간 없음. A의 추천 결과에 나타나면 안 된다.

### 장소

- 실제 확인한 신촌 장소 6~10개
- 그중 도보 5분 이하 `QUICK_MEAL` 장소 1개 이상
- `sourceLabel`, `verifiedAt` 포함

seed ID는 프론트 Mock과 달라도 되지만 응답 shape는 같아야 한다.

## 8. P0 smoke test

아래 순서가 한 번에 성공해야 한다.

1. A 계정 로그인
2. A 프로필 조회
3. A 시간표 전체 저장
4. A 공강 `MONDAY 12:00~14:00` 확인
5. A 선호 시간 저장
6. B가 매칭 목록에 나타나는지 확인
7. 매칭 응답에 학과·학생 유형·시간표가 없는지 확인
8. `12:00~13:00`, `LUNCH`로 장소 추천
9. 최대 3개이며 가까운 빠른 식사 장소가 상위인지 확인
10. 추천 장소를 선택해 Proposal 생성
11. B 계정 로그인
12. 받은 Proposal 조회
13. Proposal 수락
14. A와 B 모두 `status=ACCEPTED` 목록에서 확인

## 9. 필수 실패 테스트

| 상황 | 기대 결과 |
|---|---|
| 잘못된 데모 비밀번호 | `401 INVALID_CREDENTIALS` |
| 겹치는 수업 전체 저장 | `409 CLASS_TIME_OVERLAP`, 일부 저장 없음 |
| 유효 가능 시간 없음 | 매칭 `409 NO_EFFECTIVE_AVAILABILITY` |
| 차단된 사용자 | 추천 제외, 제안 `409 USER_BLOCKED` |
| 날짜 요일 불일치 | `422 DATE_WEEKDAY_MISMATCH` |
| 공통 시간 밖 제안 | `422 TIME_NOT_IN_COMMON_SLOT` |
| 기존 ACCEPTED 제안과 충돌 | `409 CONFIRMED_PROPOSAL_TIME_CONFLICT` |
| 수락 전에 시간표 변경 | `409 COMMON_SLOT_CHANGED` |
| 동시 수락 | 하나 성공, 하나 `409 PROPOSAL_NOT_PENDING` |
| 장소 후보 없음 | `200`, 빈 배열, `allowCustomPlace: true` |

## 10. 병합 후 검증

```text
1. clean clone
2. 환경변수 예시 복사
3. dependency 설치
4. migration
5. seed
6. test
7. server 실행
8. smoke test
```

명령은 실제 스택에 맞춰 프로젝트 README에 복사 가능한 형태로 작성한다.

## 11. 16:00 동결 기준

16:00이 되면 다음 행동만 허용한다.

- 빌드·실행 실패 수정
- P0 데모 경로 버그 수정
- seed 안정화
- 응답 shape 불일치 수정
- README 실행 방법 보완

다음은 시작하지 않는다.

- P1 endpoint
- 실제 지도 API
- OCR·AI 신규 연동
- 리팩터링과 추상화 확장
- 성능 최적화

## 12. 최종 인수 체크리스트

- [ ] A와 B의 소유 파일 충돌이 없다.
- [ ] clean clone에서 실행된다.
- [ ] migration과 seed가 재실행 가능하다.
- [ ] 단위 테스트와 smoke test가 통과한다.
- [ ] API 명세와 응답 shape가 일치한다.
- [ ] Proposal이 약속의 단일 원본이다.
- [ ] 개인정보 금지 필드가 추천에 없다.
- [ ] AI·외부 API 없이 데모가 동작한다.
- [ ] 신규 기능이 동결됐다.
