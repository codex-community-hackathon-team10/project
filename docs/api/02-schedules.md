# 시간표·공강·선호 시간 API

## 타입

```ts
type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";

type TimeSlot = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
};
```

## GET `/me/schedules`

현재 사용자의 수업을 요일·시작 시각·ID 순으로 반환한다.

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "schedule_01",
      "dayOfWeek": "MONDAY",
      "subjectName": "통계학",
      "startTime": "10:00",
      "endTime": "12:00",
      "classroom": "공학관 101호",
      "createdAt": "2026-08-16T06:20:00Z",
      "updatedAt": "2026-08-16T06:20:00Z"
    }
  ]
}
```

## POST `/me/schedules`

수업 하나를 등록한다.

### Request Body

```json
{
  "dayOfWeek": "MONDAY",
  "subjectName": "통계학",
  "startTime": "10:00",
  "endTime": "12:00",
  "classroom": "공학관 101호"
}
```

### 검증

- 요일은 월~금이다.
- 시각은 30분 단위이며 시작 < 종료다.
- 같은 요일의 기존 수업과 겹칠 수 없다.
- 과목명은 1~100자, 강의실은 `null` 또는 최대 100자다.

### Success `201 Created`

```http
Location: /api/v1/me/schedules/schedule_01
```

```json
{
  "data": {
    "id": "schedule_01",
    "dayOfWeek": "MONDAY",
    "subjectName": "통계학",
    "startTime": "10:00",
    "endTime": "12:00",
    "classroom": "공학관 101호",
    "createdAt": "2026-08-16T06:20:00Z",
    "updatedAt": "2026-08-16T06:20:00Z"
  }
}
```

### Errors

- `409 SCHEDULE_TIME_OVERLAP`
- `422 INVALID_TIME_RANGE`
- `422 INVALID_TIME_UNIT`

## PATCH `/me/schedules/{scheduleId}`

내 수업 일부를 수정한다. 생략 필드는 유지하고 `classroom: null`로 강의실을 삭제한다.

### Request Body 예시

```json
{
  "startTime": "10:30",
  "endTime": "12:30",
  "classroom": null
}
```

### Success `200 OK`

수정된 전체 수업 객체를 반환한다.

### Errors

- `404 SCHEDULE_NOT_FOUND`
- 생성과 동일한 시간 검증 오류

## DELETE `/me/schedules/{scheduleId}`

내 수업을 삭제한다.

### Success `204 No Content`

Body 없음.

### Errors

- `404 SCHEDULE_NOT_FOUND`

## GET `/me/free-times`

11:00~15:00에서 수업 구간을 제외한 공강을 계산한다.

### Query

| 이름 | 기본값 | 규칙 |
|---|---:|---|
| `minimumMinutes` | `30` | 30 이상, 30분 단위 |

### 계산 규칙

1. 요일별 수업을 시작 시각순으로 정렬한다.
2. 겹치거나 인접한 구간을 병합한다.
3. 서비스 시간과 겹치는 수업만 반영한다.
4. `11:00~15:00`에서 수업 합집합을 뺀다.
5. `minimumMinutes` 미만 공강을 제거한다.

### Success `200 OK`

```json
{
  "data": {
    "serviceWindow": {
      "startTime": "11:00",
      "endTime": "15:00",
      "timeZone": "Asia/Seoul"
    },
    "slots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "14:00",
        "durationMinutes": 120
      }
    ],
    "calculatedAt": "2026-08-16T06:25:00Z"
  }
}
```

수업이 없는 요일은 `11:00~15:00` 전체를 반환한다.

## GET `/me/availability`

사용자가 입력한 선호 시간과 계산된 유효 가능 시간을 반환한다.

### Success `200 OK`

```json
{
  "data": {
    "preferredSlots": [
      {
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "14:00"
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
    "updatedAt": "2026-08-16T06:30:00Z"
  }
}
```

## PUT `/me/availability`

요일별 선호 시간을 전체 교체한다. 최소 만남 시간은 이 API가 아니라 `/me/match-preferences`에서 관리한다.

### Request Body

```json
{
  "preferredSlots": [
    {
      "dayOfWeek": "MONDAY",
      "startTime": "12:00",
      "endTime": "14:00"
    }
  ]
}
```

### 정책

- 11:00~15:00, 30분 단위다.
- 같은 요일의 인접·중첩 구간은 병합해 저장한다.
- 공강과 겹치지 않아도 저장은 성공하고 `effectiveSlots`가 비게 된다.
- 저장 후 GET과 동일한 결과를 반환한다.
