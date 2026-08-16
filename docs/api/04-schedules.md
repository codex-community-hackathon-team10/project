# Schedule API

## 목적

주간 반복 수업을 저장하고 평일 11:00~15:00의 점심 공강을 조회한다. P0는 목록 조회와 전체 교체만 구현하고 개별 CRUD는 P1, OCR은 P2다. 상대 사용자에게 이 문서의 수업 리소스를 절대 노출하지 않는다.

## 공통 타입

```ts
type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY";

type ClassItem = {
  id: string;
  dayOfWeek: DayOfWeek;
  courseName: string;
  startTime: string;
  endTime: string;
  location: string | null;
  createdAt: string;
  updatedAt: string;
};

type TimeSlot = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
};
```

`startTime`, `endTime`은 `HH:mm` 형식이며 30분 단위다.

## GET `/users/me/classes` `[P0]`

내 주간 수업 목록을 조회한다.

### 인증

Bearer Token 필요

### Success `200 OK`

요일, 시작 시간, ID 순으로 정렬한다.

```json
{
  "data": [
    {
      "id": "class_01JZ8C9MDR42RTG1H2J84ZPKRQ",
      "dayOfWeek": "MONDAY",
      "courseName": "통계학",
      "startTime": "10:00",
      "endTime": "12:00",
      "location": "공학관 101호",
      "createdAt": "2026-08-16T05:20:00Z",
      "updatedAt": "2026-08-16T05:20:00Z"
    },
    {
      "id": "class_01JZ8CBM46AHDGZV8Y83E2R2RQ",
      "dayOfWeek": "MONDAY",
      "courseName": "데이터마이닝",
      "startTime": "14:00",
      "endTime": "16:00",
      "location": null,
      "createdAt": "2026-08-16T05:21:00Z",
      "updatedAt": "2026-08-16T05:21:00Z"
    }
  ]
}
```

수업이 없으면 `data: []`를 반환한다.

## PUT `/users/me/classes` `[P0]`

내 주간 수업 목록을 한 번에 전체 교체한다. 해커톤 P0에서 수업 추가·수정·삭제 UI는 이 API 하나를 사용한다.

### 인증

Bearer Token 필요

### Request Body

```json
{
  "classes": [
    {
      "dayOfWeek": "MONDAY",
      "courseName": "통계학",
      "startTime": "10:00",
      "endTime": "12:00",
      "location": "공학관 101호"
    },
    {
      "dayOfWeek": "MONDAY",
      "courseName": "데이터마이닝",
      "startTime": "14:00",
      "endTime": "16:00",
      "location": null
    }
  ]
}
```

### 검증

- `classes`는 0~50개다. 빈 배열은 전체 시간표 삭제를 의미한다.
- 각 항목은 개별 수업 등록과 같은 요일·시간·문자열 규칙을 사용한다.
- 같은 요일의 수업이 서로 겹치면 전체 요청을 실패시킨다.
- 일부만 저장하지 않고 하나의 트랜잭션으로 전체 교체한다.

### Success `200 OK`

```json
{
  "data": {
    "classes": [
      {
        "id": "class_01JZ8C9MDR42RTG1H2J84ZPKRQ",
        "dayOfWeek": "MONDAY",
        "courseName": "통계학",
        "startTime": "10:00",
        "endTime": "12:00",
        "location": "공학관 101호",
        "createdAt": "2026-08-16T05:20:00Z",
        "updatedAt": "2026-08-16T05:20:00Z"
      }
    ],
    "freeSlots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "14:00",
        "durationMinutes": 120
      }
    ]
  }
}
```

실제 응답의 `classes`와 `freeSlots`에는 전체 요일 결과가 포함된다.

### Errors

- `409 CLASS_TIME_OVERLAP`
- `422 INVALID_TIME_RANGE`
- `422 INVALID_TIME_UNIT`
- `422 TOO_MANY_CLASSES`
- `422 VALIDATION_ERROR`

## POST `/users/me/classes` `[P1]`

수업 1개를 등록한다.

### 인증

Bearer Token 필요

### Request Body

```json
{
  "dayOfWeek": "MONDAY",
  "courseName": "통계학",
  "startTime": "10:00",
  "endTime": "12:00",
  "location": "공학관 101호"
}
```

| 필드 | 필수 | 검증 |
|---|---|---|
| `dayOfWeek` | O | 평일 enum |
| `courseName` | O | 공백 제거 후 1~100자 |
| `startTime` | O | `HH:mm`, 30분 단위 |
| `endTime` | O | `HH:mm`, 30분 단위, 시작보다 늦음 |
| `location` | X | `null` 또는 최대 100자 |

시간표에는 점심 서비스 시간 밖의 수업도 등록할 수 있다.

### Success `201 Created`

```http
Location: /api/v1/users/me/classes/class_01JZ8C9MDR42RTG1H2J84ZPKRQ
```

```json
{
  "data": {
    "class": {
      "id": "class_01JZ8C9MDR42RTG1H2J84ZPKRQ",
      "dayOfWeek": "MONDAY",
      "courseName": "통계학",
      "startTime": "10:00",
      "endTime": "12:00",
      "location": "공학관 101호",
      "createdAt": "2026-08-16T05:20:00Z",
      "updatedAt": "2026-08-16T05:20:00Z"
    },
    "freeSlots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "15:00",
        "durationMinutes": 180
      }
    ]
  }
}
```

`freeSlots`는 변경된 요일의 점심 공강만 반환한다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `409` | `CLASS_TIME_OVERLAP` | 같은 요일의 기존 수업과 겹침 |
| `422` | `INVALID_TIME_RANGE` | 시작·종료 관계 오류 |
| `422` | `INVALID_TIME_UNIT` | 30분 단위가 아님 |
| `422` | `VALIDATION_ERROR` | 기타 필드 오류 |

겹침 오류 예시:

```json
{
  "error": {
    "code": "CLASS_TIME_OVERLAP",
    "message": "기존 수업과 시간이 겹칩니다.",
    "details": [
      {
        "field": "startTime",
        "reason": "통계학(10:00~12:00)과 겹칩니다."
      }
    ],
    "requestId": "req_01JZ8CGXVSWKM5CXC7J1H6NGWB"
  }
}
```

## PATCH `/users/me/classes/{classId}` `[P1]`

수업 일부를 수정한다. 생략 필드는 유지하며 `location`만 `null`로 삭제할 수 있다.

### 인증

Bearer Token 필요

### Request Body 예시

```json
{
  "startTime": "10:30",
  "endTime": "12:30",
  "location": null
}
```

### Success `200 OK`

POST와 같은 `class`, 변경된 요일의 `freeSlots`를 반환한다. 요일을 변경한 경우 이전 요일과 새 요일의 공강을 모두 반환한다.

```json
{
  "data": {
    "class": {
      "id": "class_01JZ8C9MDR42RTG1H2J84ZPKRQ",
      "dayOfWeek": "MONDAY",
      "courseName": "통계학",
      "startTime": "10:30",
      "endTime": "12:30",
      "location": null,
      "createdAt": "2026-08-16T05:20:00Z",
      "updatedAt": "2026-08-16T05:30:00Z"
    },
    "freeSlots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:30",
        "endTime": "15:00",
        "durationMinutes": 150
      }
    ]
  }
}
```

### Errors

- `404 CLASS_NOT_FOUND`: 존재하지 않거나 내 수업이 아님
- POST와 동일한 시간·검증 오류

보안을 위해 다른 사용자 소유 ID도 `404`로 응답한다.

## DELETE `/users/me/classes/{classId}` `[P1]`

내 수업을 삭제한다.

### 인증

Bearer Token 필요

### Success `204 No Content`

Body 없음. 프론트는 삭제 후 `GET /users/me/free-slots`를 다시 호출한다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `CLASS_NOT_FOUND` | 존재하지 않거나 내 수업이 아님 |

## GET `/users/me/free-slots` `[P0]`

수업 시간표에서 계산한 점심 공강을 조회한다.

### 인증

Bearer Token 필요

### Query Parameters

| 이름 | 타입 | 기본값 | 설명 |
|---|---|---:|---|
| `minimumMinutes` | integer | `30` | `30`, `60`, `90`, `120` 중 하나 |

### 계산 규칙

1. 요일별 수업을 정렬한다.
2. 겹치거나 인접한 수업을 병합한다.
3. `11:00~15:00`에서 수업 구간을 뺀다.
4. `minimumMinutes` 미만 구간을 제외한다.
5. 수업 종료와 공강 시작, 공강 종료와 수업 시작의 동일 경계는 허용한다.

### Success `200 OK`

```json
{
  "data": {
    "serviceWindow": {
      "startTime": "11:00",
      "endTime": "15:00",
      "timeZone": "Asia/Seoul"
    },
    "minimumMinutes": 30,
    "hasClasses": true,
    "slots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "14:00",
        "durationMinutes": 120
      },
      {
        "dayOfWeek": "TUESDAY",
        "startTime": "11:00",
        "endTime": "15:00",
        "durationMinutes": 240
      }
    ],
    "calculatedAt": "2026-08-16T05:35:00Z"
  }
}
```

수업이 없는 요일도 전체 공강으로 포함한다. `hasClasses`는 시간표에 등록된 수업이 하나라도 있는지를 항상 반환한다. 시간표가 완전히 비어 있어도 5개 요일의 전체 공강을 반환한다.

```json
{
  "data": {
    "serviceWindow": {
      "startTime": "11:00",
      "endTime": "15:00",
      "timeZone": "Asia/Seoul"
    },
    "minimumMinutes": 30,
    "hasClasses": false,
    "slots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "11:00",
        "endTime": "15:00",
        "durationMinutes": 240
      }
    ],
    "calculatedAt": "2026-08-16T05:35:00Z"
  }
}
```

실제 응답은 월~금 5개 슬롯을 모두 포함한다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `400` | `INVALID_QUERY` | 허용하지 않는 `minimumMinutes` |
| `500` | `FREE_SLOT_CALCULATION_FAILED` | 저장 데이터 이상으로 계산 실패 |

## POST `/users/me/schedule-imports` `[P2]`

시간표 이미지를 OCR 분석해 임시 수업 후보를 만든다.

### 인증

Bearer Token 필요

### Content-Type

`multipart/form-data`

| Part | 타입 | 필수 | 검증 |
|---|---|---|---|
| `image` | binary | O | JPG/PNG, 최대 10MB |

### Success `201 Created`

동기 분석 기준 응답이다. 해커톤 MVP에서는 15초 안에 결과를 반환하지 못하면 오류로 폴백한다.

```json
{
  "data": {
    "id": "import_01JZ8DBN3Y7R4PXJF2B7K1D5YQ",
    "status": "REVIEW_REQUIRED",
    "items": [
      {
        "temporaryId": "tmp_1",
        "dayOfWeek": "MONDAY",
        "courseName": "통계학",
        "startTime": "10:00",
        "endTime": "12:00",
        "location": "공학관",
        "confidence": 0.93,
        "warnings": []
      },
      {
        "temporaryId": "tmp_2",
        "dayOfWeek": null,
        "courseName": "데이터마이닝",
        "startTime": "14:00",
        "endTime": "16:00",
        "location": null,
        "confidence": 0.51,
        "warnings": ["요일을 확인해 주세요."]
      }
    ],
    "createdAt": "2026-08-16T05:40:00Z"
  }
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `413` | `FILE_TOO_LARGE` | 10MB 초과 |
| `415` | `UNSUPPORTED_FILE_TYPE` | JPG/PNG가 아님 |
| `422` | `OCR_NO_RESULT` | 수업 후보 없음 |
| `502` | `OCR_UPSTREAM_ERROR` | OCR 서비스 장애·시간 초과 |

## POST `/users/me/schedule-imports/{importId}/confirm` `[P2]`

사용자가 검토·수정한 OCR 결과를 실제 수업으로 저장한다.

### Request Body

```json
{
  "classes": [
    {
      "dayOfWeek": "MONDAY",
      "courseName": "통계학",
      "startTime": "10:00",
      "endTime": "12:00",
      "location": "공학관"
    }
  ]
}
```

### Success `200 OK`

```json
{
  "data": {
    "importId": "import_01JZ8DBN3Y7R4PXJF2B7K1D5YQ",
    "status": "CONFIRMED",
    "createdClasses": [
      {
        "id": "class_01JZ8DJEJP40RV7GHNX8DBQFZM",
        "dayOfWeek": "MONDAY",
        "courseName": "통계학",
        "startTime": "10:00",
        "endTime": "12:00",
        "location": "공학관",
        "createdAt": "2026-08-16T05:45:00Z",
        "updatedAt": "2026-08-16T05:45:00Z"
      }
    ]
  }
}
```

### Errors

- `404 SCHEDULE_IMPORT_NOT_FOUND`
- `409 SCHEDULE_IMPORT_ALREADY_CONFIRMED`
- `409 CLASS_TIME_OVERLAP`
- `422 VALIDATION_ERROR`

하나라도 충돌하면 일부만 저장하지 않고 전체 요청을 실패시킨다.

## 프론트 Mock 상태

1. 수업 없음
2. 월요일 `10:00~12:00`, `14:00~16:00` 수업과 `12:00~14:00` 공강
3. 수업 시간 겹침 `409`
4. 공강 없음 `slots: []`
5. OCR 성공·부분 인식·외부 오류
