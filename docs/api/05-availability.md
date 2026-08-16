# Availability API

## 목적

시간표상 공강과 별개로 실제 만남을 원하는 주간 시간대와 최소 만남 시간을 저장하고, 매칭에 사용되는 유효 가능 시간을 반환한다.

## 타입

```ts
type PreferredSlot = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

type Availability = {
  minimumMeetingMinutes: 30 | 60 | 90 | 120;
  preferredSlots: PreferredSlot[];
  effectiveSlots: Array<PreferredSlot & { durationMinutes: number }>;
  updatedAt: string;
};
```

`effectiveSlots`는 공강과 `preferredSlots`의 교집합이며 서버가 계산한다.

## GET `/users/me/availability` `[P0]`

내 선호 시간과 계산된 유효 가능 시간을 조회한다.

### 인증

Bearer Token 필요

### Success `200 OK`

```json
{
  "data": {
    "minimumMeetingMinutes": 60,
    "preferredSlots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "14:00"
      },
      {
        "dayOfWeek": "WEDNESDAY",
        "startTime": "13:00",
        "endTime": "15:00"
      }
    ],
    "effectiveSlots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "14:00",
        "durationMinutes": 120
      },
      {
        "dayOfWeek": "WEDNESDAY",
        "startTime": "13:30",
        "endTime": "15:00",
        "durationMinutes": 90
      }
    ],
    "updatedAt": "2026-08-16T06:00:00Z"
  }
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `AVAILABILITY_NOT_FOUND` | 아직 설정하지 않음 |

## PUT `/users/me/availability` `[P0]`

선호 시간을 전체 교체한다. 멱등 요청이다.

### 인증

Bearer Token 필요

### Request Body

```json
{
  "minimumMeetingMinutes": 60,
  "preferredSlots": [
    {
      "dayOfWeek": "MONDAY",
      "startTime": "12:00",
      "endTime": "14:00"
    },
    {
      "dayOfWeek": "WEDNESDAY",
      "startTime": "13:00",
      "endTime": "15:00"
    }
  ]
}
```

### 검증

| 필드 | 규칙 |
|---|---|
| `minimumMeetingMinutes` | `30`, `60`, `90`, `120` 중 하나 |
| `preferredSlots` | 최소 1개, 최대 10개 |
| `dayOfWeek` | 평일 enum |
| `startTime`, `endTime` | `11:00~15:00`, 30분 단위, 시작 < 종료 |

- 같은 요일의 겹치거나 인접한 선호 구간은 서버가 병합해 반환한다.
- `effectiveSlots` 중 최소 만남 시간 미만인 구간은 제외한다.
- 공강과 전혀 겹치지 않아도 설정 자체는 저장한다. 이 경우 경고와 빈 유효 구간을 반환한다.

### Success `200 OK`

```json
{
  "data": {
    "minimumMeetingMinutes": 60,
    "preferredSlots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "14:00"
      },
      {
        "dayOfWeek": "WEDNESDAY",
        "startTime": "13:00",
        "endTime": "15:00"
      }
    ],
    "effectiveSlots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "14:00",
        "durationMinutes": 120
      }
    ],
    "warnings": [
      {
        "code": "NO_FREE_SLOT_OVERLAP",
        "dayOfWeek": "WEDNESDAY",
        "message": "수요일 선호 시간은 현재 공강과 겹치지 않습니다."
      }
    ],
    "updatedAt": "2026-08-16T06:00:00Z"
  }
}
```

경고가 없으면 `warnings: []`를 반환한다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `422` | `INVALID_TIME_RANGE` | 서비스 시간 밖 또는 시작·종료 오류 |
| `422` | `INVALID_TIME_UNIT` | 30분 단위 아님 |
| `422` | `TOO_MANY_PREFERRED_SLOTS` | 10개 초과 |
| `422` | `VALIDATION_ERROR` | 기타 입력 오류 |

## 프론트 구현 메모

- 화면 편집 상태에는 사용자가 입력한 `preferredSlots`를 사용한다.
- 추천 가능 여부 표시에는 서버의 `effectiveSlots`를 사용한다.
- `warnings`는 저장 실패가 아니므로 성공 토스트와 함께 경고를 표시한다.
- 시간표 수정 후에는 이 API를 다시 조회해 유효 구간을 갱신한다.

## 프론트 Mock 상태

1. 설정 없음 `404`
2. 선호 시간과 공강이 모두 겹침
3. 일부 요일만 겹치고 `warnings` 존재
4. 저장은 성공했지만 `effectiveSlots: []`
5. 잘못된 시간 단위 `422`
