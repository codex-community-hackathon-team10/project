# 만남 제안·약속 API

## 상태 모델

`MeetingProposal`이 제안과 약속의 단일 원본이다. 별도 Appointment 테이블을 만들지 않는다.

| 상태 | 의미 | 가능한 변경 |
|---|---|---|
| `PENDING` | 수신자 응답 대기 | `ACCEPTED`, `REJECTED`, `CANCELED` |
| `ACCEPTED` | 확정 약속 | `CANCELED` |
| `REJECTED` | 수신자 거절 | 없음 |
| `CANCELED` | 발신자 또는 참여자 취소 | 없음 |

## POST `/meeting-proposals`

추천 상대에게 점심 만남을 제안한다.

### Request — 추천 장소

```json
{
  "receiverId": "user_b",
  "date": "2026-08-17",
  "startTime": "12:00",
  "endTime": "13:00",
  "activity": "LUNCH",
  "venue": {
    "type": "RECOMMENDED",
    "venueId": "venue_student_hall"
  },
  "message": "월요일에 같이 점심 먹어요!"
}
```

### Request — 직접 입력

```json
{
  "receiverId": "user_b",
  "date": "2026-08-17",
  "startTime": "12:00",
  "endTime": "13:00",
  "activity": "LUNCH",
  "venue": {
    "type": "CUSTOM",
    "name": "학생회관 1층"
  },
  "message": null
}
```

### 서버 검증 순서

1. 수신자가 활성 상태다.
2. 차단 기능이 구현된 경우 차단 관계가 아니다.
3. 날짜는 미래이고 시각은 30분 단위다.
4. 활동은 P0에서 `LUNCH`다.
5. 날짜 요일 기준 공통 가능 시간 안에 전체 구간이 포함된다.
6. 두 사용자의 `ACCEPTED` 제안과 시간이 겹치지 않는다.
7. 동일한 두 사용자·날짜·시간의 `PENDING`이 없다.
8. 발신자가 같은 날짜에 다른 사용자에게 유지 중인 `PENDING` 또는 `ACCEPTED` 상대가 2명 미만이다.
9. 추천 장소 ID 또는 2~50자 직접 입력이 유효하다.

`REJECTED`, `CANCELED`는 일일 2명 제한에 포함하지 않는다. 같은 상대에게 여러 제안이 있어도 서로 다른 상대 수로 계산한다.

### Success `201 Created`

```http
Location: /api/v1/meeting-proposals/proposal_01
```

```json
{
  "data": {
    "id": "proposal_01",
    "sender": {
      "id": "user_a",
      "nickname": "민지"
    },
    "receiver": {
      "id": "user_b",
      "nickname": "Alex"
    },
    "date": "2026-08-17",
    "startTime": "12:00",
    "endTime": "13:00",
    "activity": "LUNCH",
    "venue": {
      "type": "RECOMMENDED",
      "venueId": "venue_student_hall",
      "name": "학생회관 식당",
      "walkMinutes": 3,
      "priceRange": "UNDER_10000"
    },
    "message": "월요일에 같이 점심 먹어요!",
    "status": "PENDING",
    "createdAt": "2026-08-16T06:40:00Z",
    "respondedAt": null,
    "canceledBy": null
  }
}
```

추천 장소의 표시 정보는 제안 생성 시 snapshot으로 저장한다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `MATCH_NOT_FOUND` | 제안 가능한 상대가 아님 |
| `404` | `VENUE_NOT_FOUND` | 추천 장소가 없음 |
| `409` | `COMMON_TIME_CHANGED` | 최신 공통 시간이 달라짐 |
| `409` | `ACCEPTED_PROPOSAL_CONFLICT` | 확정 약속과 시간 충돌 |
| `409` | `DUPLICATE_PENDING_PROPOSAL` | 동일 상대·날짜·시간 대기 제안 |
| `409` | `DAILY_PROPOSAL_LIMIT_REACHED` | 같은 날짜 최대 2명 제한 |
| `422` | `DATE_WEEKDAY_MISMATCH` | 날짜 요일 불일치 |
| `422` | `TIME_NOT_IN_COMMON_SLOT` | 공통 시간 밖 |
| `422` | `UNSUPPORTED_ACTIVITY` | P0에서 `LUNCH`가 아님 |
| `422` | `INVALID_VENUE_SELECTION` | 추천·직접 입력 union 오류 |

## GET `/meeting-proposals`

받은·보낸 제안과 `ACCEPTED` 약속을 조회한다.

### Query

| 이름 | 기본값 | 허용값 |
|---|---:|---|
| `role` | `ALL` | `SENT`, `RECEIVED`, `ALL` |
| `status` | 전체 | 쉼표 구분 상태 |
| `limit` | `20` | `1~50` |
| `cursor` | 없음 | 서버 cursor |

약속 탭:

```http
GET /api/v1/meeting-proposals?status=ACCEPTED
```

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "proposal_01",
      "role": "RECEIVED",
      "counterpart": {
        "id": "user_a",
        "nickname": "민지"
      },
      "date": "2026-08-17",
      "startTime": "12:00",
      "endTime": "13:00",
      "activity": "LUNCH",
      "venue": {
        "type": "RECOMMENDED",
        "venueId": "venue_student_hall",
        "name": "학생회관 식당",
        "walkMinutes": 3,
        "priceRange": "UNDER_10000"
      },
      "status": "ACCEPTED",
      "createdAt": "2026-08-16T06:40:00Z"
    }
  ],
  "meta": {
    "hasNext": false,
    "nextCursor": null
  }
}
```

## PATCH `/meeting-proposals/{proposalId}/status`

제안 상태를 변경한다.

### Request Body

```json
{
  "status": "ACCEPTED"
}
```

### 권한

- 수신자: `PENDING → ACCEPTED`, `PENDING → REJECTED`
- 발신자: `PENDING → CANCELED`
- 양쪽 참여자: 시작 전 `ACCEPTED → CANCELED`

### 수락 재검증

- 최신 공통 가능 시간
- 양쪽 `ACCEPTED` 제안 시간 충돌
- 시작 시각이 미래인지
- 현재 상태가 `PENDING`인지

### Success `200 OK`

```json
{
  "data": {
    "id": "proposal_01",
    "status": "ACCEPTED",
    "respondedAt": "2026-08-16T06:50:00Z",
    "canceledBy": null
  }
}
```

### Errors

- `403 PROPOSAL_STATUS_CHANGE_FORBIDDEN`
- `404 PROPOSAL_NOT_FOUND`
- `409 PROPOSAL_STATUS_CONFLICT`
- `409 COMMON_TIME_CHANGED`
- `409 ACCEPTED_PROPOSAL_CONFLICT`
- `409 PROPOSAL_ALREADY_STARTED`

상태 변경 뒤 프론트는 목록을 재조회 또는 폴링한다. 실시간 알림은 P0가 아니다.
