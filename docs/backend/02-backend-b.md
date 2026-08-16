# Backend B — Social Flow 지침

## 미션

A의 사용자·유효 시간 view를 사용해 `메이트 추천 → 장소 추천 → 제안 → 상태 변경 → 약속 조회`를 완성한다.

## 소유 엔티티

```text
Venue
MeetingProposal
```

별도 Appointment는 없다.

## A가 준비되기 전

fake CoreQueryPort로 다음 순수 함수를 먼저 구현한다.

```text
intersectCommonSlots
calculateMatchScore
rankVenues
isTimeOverlap
countDailyProposalRecipients
validateProposalStatusTransition
```

## 매칭

필터 순서:

1. 같은 학교·캠퍼스
2. 후보 `isDiscoverable=true`
3. 자기 자신·비활성 제외
4. 공통 유효 시간 존재
5. 양쪽 최소 시간 중 더 긴 값 충족
6. 점수와 안정적 tie-breaker 적용

추천 응답에 학과·학생 유형·전체 시간표를 넣지 않는다.

## 장소 추천

- 사전 검수 seed만 사용한다.
- P0 활동은 `LUNCH`만 허용한다.
- 60분 이하는 도보 5분·빠른 식사 우선이다.
- 90분 이상은 대화·여유 태그를 가산한다.
- 최대 3개다.
- AI는 이유 한 문장만 다듬고 실패하면 템플릿을 사용한다.
- 후보 없음은 `200`, 빈 배열과 `allowCustomVenue=true`다.

## 제안 생성

검증 순서:

1. 수신자 활성 상태
2. 미래 날짜, 30분 단위
3. `LUNCH` 활동
4. 날짜 요일 기준 공통 가능 시간 포함
5. 양쪽 `ACCEPTED` 시간 충돌 없음
6. 동일 상대·날짜·시간 `PENDING` 없음
7. 발신자의 같은 날짜 유지 상대가 2명 미만
8. 추천 장소 또는 2~50자 직접 입력

일일 제한은 서로 다른 상대를 센다. `PENDING`, `ACCEPTED`만 포함하고 `REJECTED`, `CANCELED`는 제외한다.

## 상태 변경

단일 endpoint:

```text
PATCH /meeting-proposals/{proposalId}/status
```

- 수신자: PENDING → ACCEPTED/REJECTED
- 발신자: PENDING → CANCELED
- 양쪽: 시작 전 ACCEPTED → CANCELED

수락 직전에 공통 시간과 확정 약속 충돌을 다시 검사한다. 조건부 update 또는 lock으로 동시 수락은 한 번만 성공시킨다.

## 완료 기준

- [ ] 발견 비허용·시간 미달 후보가 제외된다.
- [ ] 매칭 점수와 reasons 합이 일치한다.
- [ ] 장소는 seed에서 최대 3개만 반환된다.
- [ ] 직접 장소로 제안을 계속할 수 있다.
- [ ] 같은 날짜 최대 2명 제한이 동작한다.
- [ ] 생성·수락 양쪽에서 `ACCEPTED` 충돌을 검사한다.
- [ ] 권한별 상태 전이가 동작한다.
- [ ] `ACCEPTED` 제안이 약속 조회에 나타난다.
- [ ] Appointment 테이블이 없다.
