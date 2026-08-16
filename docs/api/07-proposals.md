# Proposal API

## 목적

추천 상대에게 특정 날짜·시간·활동·장소로 만남을 제안하고 수락한다. `MeetingProposal`은 제안과 약속 상태의 단일 원본이며 P0에서 별도 Appointment 엔티티를 만들지 않는다.

## 상태 모델

```text
PENDING ──accept──> ACCEPTED
   ├──────reject──> REJECTED
   └──────cancel──> CANCELED

ACCEPTED ──cancel──> CANCELED
```

| 상태 | 의미 | 약속 탭 노출 |
|---|---|---|
| `PENDING` | 상대 응답 대기 | X |
| `ACCEPTED` | 수락된 확정 약속 | O |
| `REJECTED` | 상대 거절 | X |
| `CANCELED` | 발신자·참여자·시스템 취소 | 취소 내역에서만 선택 노출 |

## 타입

```ts
type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED";

type UserBrief = {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  grade: "1" | "2" | "3" | "4" | "OTHER";
  campusName: string;
};

type ProposalPlace = {
  type: "RECOMMENDED" | "CUSTOM";
  placeId: string | null;
  name: string;
  category: "RESTAURANT" | "CAFE" | "STUDY_CAFE" | null;
  walkingMinutes: number | null;
  priceRange: "LOW" | "MEDIUM" | "HIGH" | null;
};

type MeetingProposal = {
  id: string;
  sender: UserBrief;
  receiver: UserBrief;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: "Asia/Seoul";
  activity: Activity;
  place: ProposalPlace;
  message: string | null;
  status: ProposalStatus;
  createdAt: string;
  respondedAt: string | null;
  canceledAt: string | null;
  canceledByUserId: string | null;
  cancelReason: "USER_REQUESTED" | "TIME_EXPIRED" | "USER_BLOCKED" | null;
};
```

## 날짜·시간 검증 규칙

제안 생성과 수락에 공통으로 다음을 검사한다.

1. `date`의 요일이 두 사용자의 주간 공통 가능 요일과 일치한다.
2. `[startTime, endTime)` 전체가 최신 공통 가능 구간에 포함된다.
3. 제안 길이가 양쪽 최소 만남 시간 중 더 긴 값을 충족한다.
4. 두 사용자 모두 같은 날짜의 다른 `ACCEPTED` 제안과 시간이 겹치지 않는다.
5. 차단 관계가 아니며 두 사용자 모두 인증·활성 상태다.

시간 충돌 공식:

```text
newStart < acceptedEnd AND acceptedStart < newEnd
```

P0는 공휴일·휴강·보강 데이터를 반영하지 않고 해당 날짜 요일의 주간 규칙을 그대로 적용한다.

## POST `/proposals` `[P0]`

만남 제안을 생성한다.

### 인증

Bearer Token 필요, `DEMO_VERIFIED` 또는 `SCHOOL_EMAIL_VERIFIED` 필요

### 권장 헤더

```http
Idempotency-Key: 9dfc0fb4-e8a5-49ba-9ed4-59059e6dc3c1
```

### 추천 장소 Request

```json
{
  "receiverUserId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
  "date": "2026-08-17",
  "startTime": "12:00",
  "endTime": "13:00",
  "timeZone": "Asia/Seoul",
  "activity": "LUNCH",
  "placeSelection": {
    "type": "RECOMMENDED",
    "placeId": "place_sinchon_001"
  },
  "message": "월요일에 같이 점심 먹어요!"
}
```

### 직접 입력 장소 Request

```json
{
  "receiverUserId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
  "date": "2026-08-17",
  "startTime": "12:00",
  "endTime": "13:00",
  "timeZone": "Asia/Seoul",
  "activity": "LUNCH",
  "placeSelection": {
    "type": "CUSTOM",
    "name": "학생회관 1층"
  },
  "message": null
}
```

### 필드 검증

| 필드 | 필수 | 규칙 |
|---|---|---|
| `receiverUserId` | O | 자기 자신이 아닌 현재 추천 상대 |
| `date` | O | 오늘부터 28일 이내 `YYYY-MM-DD` |
| `startTime`, `endTime` | O | 30분 단위, 시작 < 종료 |
| `timeZone` | O | P0는 `Asia/Seoul` |
| `activity` | O | 두 사용자의 공통 활동 |
| `placeSelection.type` | O | `RECOMMENDED` 또는 `CUSTOM` |
| `placeSelection.placeId` | 조건부 | `RECOMMENDED`일 때 활성 캠퍼스 장소 ID |
| `placeSelection.name` | 조건부 | `CUSTOM`일 때 공백 제거 후 2~50자 |
| `message` | X | `null` 또는 최대 200자 |

추천 장소를 선택하면 서버는 최신 Place 데이터를 조회하고 표시 필드를 Proposal snapshot으로 저장한다.

### Success `201 Created`

```http
Location: /api/v1/proposals/proposal_01JZ8HR66FQ3F6VM8FJ5V5NB40
```

```json
{
  "data": {
    "id": "proposal_01JZ8HR66FQ3F6VM8FJ5V5NB40",
    "sender": {
      "userId": "01JZ8A1F01A9H9M4RNB8N4M88M",
      "nickname": "민지",
      "profileImageUrl": null,
      "grade": "3",
      "campusName": "신촌캠퍼스"
    },
    "receiver": {
      "userId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
      "nickname": "Alex",
      "profileImageUrl": null,
      "grade": "3",
      "campusName": "신촌캠퍼스"
    },
    "date": "2026-08-17",
    "startTime": "12:00",
    "endTime": "13:00",
    "timeZone": "Asia/Seoul",
    "activity": "LUNCH",
    "place": {
      "type": "RECOMMENDED",
      "placeId": "place_sinchon_001",
      "name": "캠퍼스키친",
      "category": "RESTAURANT",
      "walkingMinutes": 3,
      "priceRange": "LOW"
    },
    "message": "월요일에 같이 점심 먹어요!",
    "status": "PENDING",
    "createdAt": "2026-08-16T06:40:00Z",
    "respondedAt": null,
    "canceledAt": null,
    "canceledByUserId": null,
    "cancelReason": null
  }
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `403` | `STUDENT_VERIFICATION_REQUIRED` | 매칭 가능한 인증 상태가 아님 |
| `404` | `MATCH_NOT_FOUND` | 현재 제안 가능한 추천 상대가 아님 |
| `404` | `PLACE_NOT_FOUND` | 추천 장소 ID가 없거나 다른 캠퍼스 |
| `409` | `PROPOSAL_ALREADY_EXISTS` | 같은 상대·날짜·시간의 대기 제안 존재 |
| `409` | `COMMON_SLOT_CHANGED` | 입력 사이 공통 가능 시간 변경 |
| `409` | `CONFIRMED_PROPOSAL_TIME_CONFLICT` | 둘 중 한 명의 `ACCEPTED` 제안과 충돌 |
| `409` | `USER_BLOCKED` | 차단 관계 발생 |
| `422` | `DATE_OUT_OF_RANGE` | 과거 또는 28일 초과 |
| `422` | `DATE_WEEKDAY_MISMATCH` | 날짜 요일과 공통 가능 요일 불일치 |
| `422` | `TIME_NOT_IN_COMMON_SLOT` | 공통 시간 밖 |
| `422` | `MINIMUM_DURATION_NOT_MET` | 최소 만남 시간 미달 |
| `422` | `ACTIVITY_NOT_SHARED` | 공통 활동이 아님 |
| `422` | `PLACE_SELECTION_INVALID` | 장소 선택 union 오류 |

## GET `/proposals` `[P0]`

보낸·받은 제안과 수락된 약속을 같은 리소스에서 조회한다.

### Query Parameters

| 이름 | 타입 | 기본값 | 허용값 |
|---|---|---:|---|
| `direction` | enum | `ALL` | `SENT`, `RECEIVED`, `ALL` |
| `status` | enum list | 전체 | `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELED` |
| `timeCategory` | enum | `ALL` | `UPCOMING`, `PAST`, `ALL` |
| `limit` | integer | `20` | `1~50` |
| `cursor` | string | 없음 | 서버 cursor |

약속 탭 요청:

```http
GET /api/v1/proposals?status=ACCEPTED&timeCategory=UPCOMING
```

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "proposal_01JZ8HR66FQ3F6VM8FJ5V5NB40",
      "direction": "RECEIVED",
      "counterpart": {
        "userId": "01JZ8A1F01A9H9M4RNB8N4M88M",
        "nickname": "민지",
        "profileImageUrl": null,
        "grade": "3",
        "campusName": "신촌캠퍼스"
      },
      "date": "2026-08-17",
      "startTime": "12:00",
      "endTime": "13:00",
      "timeZone": "Asia/Seoul",
      "activity": "LUNCH",
      "place": {
        "type": "RECOMMENDED",
        "placeId": "place_sinchon_001",
        "name": "캠퍼스키친",
        "category": "RESTAURANT",
        "walkingMinutes": 3,
        "priceRange": "LOW"
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

## GET `/proposals/{proposalId}` `[P0]`

내가 발신자 또는 수신자인 제안 상세를 조회한다. `MeetingProposal` 전체를 반환한다.

### Errors

- `404 PROPOSAL_NOT_FOUND`: 존재하지 않거나 참여하지 않은 제안

## POST `/proposals/{proposalId}/accept` `[P0]`

수신자가 `PENDING` 제안을 수락한다. 별도 Appointment를 생성하지 않는다.

### Request Body

없음

### Success `200 OK`

```json
{
  "data": {
    "id": "proposal_01JZ8HR66FQ3F6VM8FJ5V5NB40",
    "status": "ACCEPTED",
    "respondedAt": "2026-08-16T06:50:00Z"
  }
}
```

### 수락 시 재검증

- 최신 주간 공통 가능 시간
- 제안 시작 시각이 미래인지
- 두 사용자의 같은 날짜 `ACCEPTED` 제안 충돌
- 차단·인증·활성 상태

제안 시작 시각이 지났으면 상태를 `CANCELED`, `cancelReason`을 `TIME_EXPIRED`로 변경하고 `409 PROPOSAL_EXPIRED`를 반환한다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `403` | `PROPOSAL_RECEIVER_ONLY` | 수신자가 아님 |
| `404` | `PROPOSAL_NOT_FOUND` | 존재하지 않거나 참여하지 않음 |
| `409` | `PROPOSAL_NOT_PENDING` | 이미 처리됨 |
| `409` | `PROPOSAL_EXPIRED` | 시작 시각이 지남 |
| `409` | `COMMON_SLOT_CHANGED` | 공통 가능 시간 변경 |
| `409` | `CONFIRMED_PROPOSAL_TIME_CONFLICT` | 확정 제안 시간 충돌 |
| `409` | `USER_BLOCKED` | 차단 관계 발생 |

## POST `/proposals/{proposalId}/reject` `[P1]`

수신자가 `PENDING` 제안을 `REJECTED`로 변경한다.

### Success `200 OK`

```json
{
  "data": {
    "id": "proposal_01JZ8HR66FQ3F6VM8FJ5V5NB40",
    "status": "REJECTED",
    "respondedAt": "2026-08-16T06:50:00Z"
  }
}
```

## POST `/proposals/{proposalId}/cancel` `[P1]`

- `PENDING`: 발신자만 취소 가능
- `ACCEPTED`: 발신자·수신자 모두 종료 전 취소 가능
- 성공 시 `CANCELED`, `cancelReason: USER_REQUESTED`로 변경

### Success `200 OK`

```json
{
  "data": {
    "id": "proposal_01JZ8HR66FQ3F6VM8FJ5V5NB40",
    "status": "CANCELED",
    "canceledAt": "2026-08-16T06:52:00Z",
    "canceledByUserId": "01JZ8A1F01A9H9M4RNB8N4M88M",
    "cancelReason": "USER_REQUESTED"
  }
}
```

## 프론트 Mock 상태

1. 추천 장소가 포함된 `PENDING` 제안
2. 직접 입력 장소가 포함된 제안
3. `ACCEPTED` 제안 약속 탭
4. 생성 시 날짜 요일 불일치 `422`
5. 생성·수락 시 확정 제안 충돌 `409`
6. 수락 시 공통 시간 변경 `409`
7. 시작 시각 경과와 자동 `CANCELED`
