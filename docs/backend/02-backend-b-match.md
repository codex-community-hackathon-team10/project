# Backend B 지침 — Match, Place & Meeting

## 1. 미션

Backend A의 인증 사용자·유효 가능 시간·차단 조회 port를 사용해 서비스의 차별 기능인 `메이트 추천 → 장소 추천 → 제안 → 수락` 경로를 완성한다.

## 2. 소유 영역

```text
match
place
proposal
place/proposal DB migration·seed
추천·충돌 단위 테스트
```

## 3. 구현 endpoint

| 순서 | Method | Path | 완료 조건 |
|---:|---|---|---|
| 1 | `GET` | `/api/v1/matches` | 필터·점수·최소 공개 카드 |
| 2 | `GET` | `/api/v1/matches/{userId}` | 추천 상세와 제안 가능 시간 |
| 3 | `GET` | `/api/v1/place-recommendations` | seed 후보 최대 3개 |
| 4 | `POST` | `/api/v1/proposals` | 날짜·장소·충돌 검증 후 생성 |
| 5 | `GET` | `/api/v1/proposals` | 받은·보낸·ACCEPTED 목록 |
| 6 | `GET` | `/api/v1/proposals/{proposalId}` | 참여자만 상세 조회 |
| 7 | `POST` | `/api/v1/proposals/{proposalId}/accept` | 재검증 후 원자적 수락 |

## 4. A의 뼈대가 오기 전 병렬 작업

A의 DB와 인증을 기다리지 말고 순수 로직부터 구현한다.

```text
calculateCommonSlots(mySlots, partnerSlots)
calculateMatchScore(input)
rankPlaces(input, places)
isTimeOverlap(a, b)
buildMatchSummary(input)
buildPlaceSummary(input)
```

임시 fake `CoreQueryPort`를 테스트에 사용한다. A의 실제 구현이 들어오면 fake를 교체하고 service 코드는 바꾸지 않는다.

## 5. 데이터 소유권

### B 소유 테이블·컬렉션

```text
places
meeting_proposals
```

별도 `appointments` 테이블을 만들지 않는다.

### meeting_proposals 필수 필드

```text
id
senderUserId
receiverUserId
date
startTime
endTime
activity
placeType
placeId nullable
placeNameSnapshot
placeMetadataSnapshot nullable
message nullable
status
respondedAt nullable
canceledAt nullable
canceledByUserId nullable
cancelReason nullable
createdAt
```

필수 index:

- `(senderUserId, date, status)`
- `(receiverUserId, date, status)`
- `placeId`
- 동일 발신자·수신자·날짜·시각의 `PENDING` 중복 방지

## 6. 매칭 구현

### 필수 필터 순서

1. 내 사용자·프로필·유효 시간 조회
2. 같은 캠퍼스 후보 조회
3. 자기 자신 제외
4. `DEMO_VERIFIED`·`SCHOOL_EMAIL_VERIFIED`만 유지
5. 차단 관계 제외
6. 공통 가능 시간이 양쪽 최소 만남 시간을 충족하는 후보만 유지
7. 점수 계산과 정렬

### 점수 v1

| 항목 | 점수 |
|---|---:|
| 공통 가능 시간 | 30분당 10점, 최대 60점 |
| `LUNCH` 활동 일치 | 20점 |
| 그 외 공통 활동 | 항목당 5점, 최대 15점 |
| 공통 관심사 | 항목당 3점, 최대 15점 |
| 언어교환 상호 일치 | 10점 |

추천 응답에서 금지할 정보:

- 이메일, 연락처
- 학과, 학생 유형, 자기소개
- 개별 선호 시간과 전체 시간표
- 과목명, 강의실

필수 테스트:

- 자기 자신 제외
- 다른 캠퍼스 제외
- 미인증 사용자 제외
- 차단 양방향 제외
- 최소 시간 미달 제외
- 동일 점수 tie-breaker 안정성

## 7. 장소 추천 구현

P0는 실제 외부 검색 API를 호출하지 않는다. 검증된 신촌 캠퍼스 장소 6~10개를 seed한다.

### 장소 점수 v1

| 항목 | 점수 |
|---|---:|
| 활동 카테고리 일치 | 40점 |
| 예산 일치 | 20점 |
| 분위기 일치 | 15점 |
| 도보 5분 이하 | 20점 |
| 도보 6~10분 | 10점 |
| 60분 이하이고 빠른 식사 가능 | 20점 |

- 점수 내림차순, 도보 시간 오름차순, 장소 ID 순으로 정렬한다.
- 최대 3개만 반환한다.
- LLM으로 장소명·거리·가격·영업 정보를 만들지 않는다.
- 추천 이유는 템플릿을 기본으로 구현한다.
- AI 연동은 템플릿이 완성된 뒤 시간이 남을 때만 한다.
- seed의 실제 장소는 팀이 존재 여부를 확인하고 출처·확인 시각을 기록한다.

## 8. 제안 생성 검증

다음 검증은 순서를 고정한다.

1. 발신자와 수신자 인증·활성 상태
2. 자기 자신 여부
3. 차단 관계
4. 요청 날짜가 오늘부터 28일 이내인지
5. 날짜 요일과 주간 공통 가능 요일이 같은지
6. 요청 시간 전체가 공통 가능 구간 안인지
7. 양쪽 최소 만남 시간을 충족하는지
8. 활동이 공통 활동인지
9. 추천 또는 직접 입력 장소 union이 유효한지
10. 두 사용자 각각의 같은 날짜 `ACCEPTED` 제안과 겹치지 않는지
11. 중복 `PENDING`이 없는지

공휴일·휴강은 P0에서 검사하지 않는다.

### 장소 snapshot

추천 장소를 선택하면 이름, 카테고리, 도보 시간, 가격대를 Proposal에 복사한다. 이후 Place seed가 바뀌어도 약속 카드에는 snapshot을 사용한다.

## 9. 수락 트랜잭션

수락은 다음 작업을 하나의 트랜잭션으로 수행한다.

1. Proposal을 잠그거나 조건부 업데이트한다.
2. 상태가 `PENDING`인지 확인한다.
3. 현재 사용자가 수신자인지 확인한다.
4. 시작 시각이 미래인지 확인한다.
5. 최신 공통 가능 시간을 다시 계산한다.
6. 양쪽 사용자의 `ACCEPTED` 제안 충돌을 다시 확인한다.
7. 상태를 `ACCEPTED`, `respondedAt`을 현재 시각으로 변경한다.

동시에 두 번 수락하면 한 요청만 성공하고 다른 요청은 `409 PROPOSAL_NOT_PENDING`을 반환해야 한다.

시작 시각이 이미 지났으면 `CANCELED`, `cancelReason: TIME_EXPIRED`로 변경하고 `409 PROPOSAL_EXPIRED`를 반환한다.

## 10. A와의 연결 지점

B는 A의 DB 테이블을 직접 조립해 읽기보다 `CoreQueryPort`를 사용한다.

```ts
constructor(
  private readonly coreQuery: CoreQueryPort,
  private readonly placeRepository: PlaceRepository,
  private readonly proposalRepository: ProposalRepository
) {}
```

필요한 core 필드가 부족하면 A의 파일을 직접 고치지 말고 projection 변경을 요청한다. 개인정보 금지 필드는 projection에 추가하지 않는다.

## 11. 금지 사항

- 별도 Appointment 모델·테이블·endpoint를 만들지 않는다.
- AI로 사용자·장소 후보를 생성하지 않는다.
- Controller에 점수와 충돌 로직을 넣지 않는다.
- 추천 실패를 500으로만 끝내지 않는다. 장소 후보가 없으면 빈 배열과 직접 입력 가능 상태를 반환한다.
- A 소유 auth/profile/schedule 파일을 직접 수정하지 않는다.
- P1 제안 거절·취소부터 구현하지 않는다.

## 12. 완료 체크리스트

- [ ] 매칭 필터와 점수 테스트가 통과한다.
- [ ] 추천 카드에 금지 정보가 없다.
- [ ] 장소 추천은 seed에서 최대 3개만 반환한다.
- [ ] 60분 이하에서 가까운 빠른 식사 장소가 우선된다.
- [ ] 장소 추천 실패에도 직접 장소 제안이 가능하다.
- [ ] 제안 생성 시 날짜 요일과 확정 충돌을 검사한다.
- [ ] 수락 시 동일 검증을 다시 수행한다.
- [ ] 동시 수락에서 한 번만 성공한다.
- [ ] `ACCEPTED` 제안이 약속 조회에 나타난다.
- [ ] Appointment 테이블이 없다.
