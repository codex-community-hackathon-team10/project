# Matching API

## 목적

동일 학교·캠퍼스의 인증 사용자 중 공통 가능 시간이 최소 만남 시간을 충족하는 사용자를 규칙 기반 점수순으로 추천한다. 추천 카드는 최소 공개 원칙을 적용한다.

## 추천 전제 조건

다음 조건을 모두 만족해야 추천 API를 사용할 수 있다.

1. 프로필 상태가 `COMPLETE`다.
2. 활동을 1개 이상 설정했다.
3. 선호 만남 시간을 저장했다.
4. 공강과 선호 시간의 교집합인 유효 가능 시간이 1개 이상이다.
5. 사용자 인증 상태가 `DEMO_VERIFIED` 또는 `SCHOOL_EMAIL_VERIFIED`다.

시간표가 비어 있으면 평일 11:00~15:00 전체를 공강으로 계산하므로 추천 자체는 가능하다.

## 타입

```ts
type CommonSlot = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  nextDate: string;
};

type MatchReason = {
  type:
    | "COMMON_TIME"
    | "COMMON_ACTIVITY"
    | "COMMON_INTEREST"
    | "LANGUAGE_EXCHANGE";
  label: string;
  score: number;
};

type MatchCandidate = {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  grade: "1" | "2" | "3" | "4" | "OTHER";
  campus: { id: string; name: string };
  commonSlots: CommonSlot[];
  commonActivities: Activity[];
  commonInterests: Interest[];
  score: number;
  reasons: MatchReason[];
  summary: string;
};
```

## 점수 규칙 v1

| 항목 | 점수 |
|---|---:|
| 가장 긴 공통 가능 시간 | 30분당 10점, 최대 60점 |
| `LUNCH` 활동 일치 | 20점 |
| 그 외 공통 활동 | 항목당 5점, 최대 15점 |
| 공통 관심사 | 항목당 3점, 최대 15점 |
| 언어교환 상호 일치 | 10점 |

동점 정렬은 가장 긴 공통 시간, 공통 관심사 수, 최근 활동 시각, 사용자 ID 순이다.

## GET `/matches` `[P0]`

추천 후보 목록을 조회한다.

### 인증

Bearer Token 필요

### Query Parameters

| 이름 | 타입 | 기본값 | 제약 |
|---|---|---:|---|
| `limit` | integer | `10` | `1~20` |
| `cursor` | string | 없음 | 서버 발급 cursor |
| `dayOfWeek` | enum | 없음 | 특정 요일 필터, 선택 |

### 필터 규칙

서버는 다음 사용자를 제외한다.

- 자기 자신
- 다른 학교 또는 다른 캠퍼스 사용자
- `UNVERIFIED` 사용자
- 공통 유효 가능 시간이 없는 사용자
- 두 사용자 중 더 긴 최소 만남 시간을 충족하지 못하는 사용자
- 내가 차단했거나 나를 차단한 사용자
- 탈퇴·이용 제한 사용자
- `SKIP` 처리한 사용자

### Success `200 OK`

```json
{
  "data": [
    {
      "userId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
      "nickname": "Alex",
      "profileImageUrl": "https://cdn.example.com/profiles/alex.jpg",
      "grade": "3",
      "campus": {
        "id": "campus_yonsei_sinchon",
        "name": "신촌캠퍼스"
      },
      "commonSlots": [
        {
          "dayOfWeek": "MONDAY",
          "startTime": "12:00",
          "endTime": "13:30",
          "durationMinutes": 90,
          "nextDate": "2026-08-17"
        }
      ],
      "commonActivities": ["LUNCH", "LANGUAGE_EXCHANGE"],
      "commonInterests": ["MUSIC", "TRAVEL"],
      "score": 71,
      "reasons": [
        {
          "type": "COMMON_TIME",
          "label": "공강 90분 일치",
          "score": 30
        },
        {
          "type": "COMMON_ACTIVITY",
          "label": "점심·언어교환 활동 일치",
          "score": 25
        },
        {
          "type": "COMMON_INTEREST",
          "label": "관심사 2개 일치",
          "score": 6
        },
        {
          "type": "LANGUAGE_EXCHANGE",
          "label": "서로 연습하고 싶은 언어가 맞아요",
          "score": 10
        }
      ],
      "summary": "월요일 12:00~13:30에 공강이 겹치고, 두 분 모두 점심과 언어교환을 선호해요."
    }
  ],
  "meta": {
    "hasNext": false,
    "nextCursor": null,
    "scoreVersion": "v1",
    "generatedAt": "2026-08-16T06:20:00Z"
  }
}
```

응답의 `score`는 모든 `reasons[].score` 합과 일치해야 한다. 프론트는 점수를 직접 재계산하지 않고 `reasons`를 표시한다.

### Empty `200 OK`

```json
{
  "data": [],
  "meta": {
    "hasNext": false,
    "nextCursor": null,
    "scoreVersion": "v1",
    "generatedAt": "2026-08-16T06:20:00Z",
    "emptyReason": "NO_MATCHING_USERS",
    "suggestions": [
      "선호 시간을 넓혀보세요.",
      "최소 만남 시간을 줄여보세요."
    ]
  }
}
```

`emptyReason` enum:

```text
NO_MATCHING_USERS | ALL_CANDIDATES_SKIPPED
```

### Errors

| Status | code | 조건 | 이동/처리 |
|---:|---|---|---|
| `409` | `PROFILE_INCOMPLETE` | 프로필 미완성 | 프로필 설정 |
| `409` | `AVAILABILITY_REQUIRED` | 선호 시간 없음 | 선호 시간 설정 |
| `409` | `NO_EFFECTIVE_AVAILABILITY` | 유효 가능 시간 없음 | 시간표·선호 시간 수정 |
| `403` | `STUDENT_VERIFICATION_REQUIRED` | 학생 인증 상태 아님 | 인증 안내 |
| `400` | `INVALID_QUERY` | 필터·cursor 오류 | 쿼리 수정 |

## GET `/matches/{userId}` `[P0]`

현재 추천 가능한 상대의 상세 정보를 조회한다.

### 인증

Bearer Token 필요

### Success `200 OK`

`MatchCandidate` 전체와 제안 가능한 날짜·시간 후보를 반환한다.

```json
{
  "data": {
    "candidate": {
      "userId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
      "nickname": "Alex",
      "profileImageUrl": null,
      "grade": "3",
      "campus": {
        "id": "campus_yonsei_sinchon",
        "name": "신촌캠퍼스"
      },
      "commonSlots": [
        {
          "dayOfWeek": "MONDAY",
          "startTime": "12:00",
          "endTime": "13:30",
          "durationMinutes": 90,
          "nextDate": "2026-08-17"
        }
      ],
      "commonActivities": ["LUNCH", "LANGUAGE_EXCHANGE"],
      "commonInterests": ["MUSIC", "TRAVEL"],
      "score": 61,
      "reasons": [
        {
          "type": "COMMON_TIME",
          "label": "공강 90분 일치",
          "score": 30
        },
        {
          "type": "COMMON_ACTIVITY",
          "label": "점심·언어교환 활동 일치",
          "score": 25
        },
        {
          "type": "COMMON_INTEREST",
          "label": "관심사 2개 일치",
          "score": 6
        }
      ],
      "summary": "월요일 점심시간에 90분 동안 만날 수 있어요."
    },
    "proposalOptions": [
      {
        "date": "2026-08-17",
        "dayOfWeek": "MONDAY",
        "startTime": "12:00",
        "endTime": "13:30",
        "timeZone": "Asia/Seoul"
      }
    ]
  }
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `MATCH_NOT_FOUND` | 사용자 없음 또는 현재 추천 조건 불충족 |
| `409` | `MATCH_NO_LONGER_AVAILABLE` | 조회 사이 공통 시간이 사라짐 |

개인정보 보호를 위해 차단·캠퍼스 불일치도 상세 사유 없이 `404 MATCH_NOT_FOUND`로 처리할 수 있다.

## POST `/match-actions` `[P1]`

추천 상대에게 관심을 표시하거나 추천에서 넘긴다.

### Request Body

```json
{
  "targetUserId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
  "action": "INTEREST"
}
```

`action` enum:

```text
INTEREST | SKIP
```

### Success `201 Created`

```json
{
  "data": {
    "id": "action_01JZ8GPRFBAHQQVGX5XPMBKT0P",
    "targetUserId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
    "action": "INTEREST",
    "isMutualInterest": false,
    "createdAt": "2026-08-16T06:30:00Z"
  }
}
```

동일 액션을 다시 요청하면 새 리소스를 만들지 않고 기존 리소스를 `200 OK`로 반환한다.

### Errors

- `404 MATCH_NOT_FOUND`
- `409 MATCH_ACTION_CONFLICT`: 기존 `SKIP`과 반대 액션 등 상태 충돌
- `422 VALIDATION_ERROR`

## AI 추천 문구 폴백

`summary`는 항상 존재한다. AI 기능이 꺼져 있거나 실패하면 서버가 다음 데이터만으로 템플릿을 생성한다.

```text
{요일} {시작}~{종료}에 공강이 겹치고, 두 분 모두 {공통 활동}을 선호해요.
```

AI 실패는 API 오류로 노출하지 않으며 추천 응답의 `summarySource` 필드를 선택적으로 반환할 수 있다.

```json
{
  "summarySource": "TEMPLATE"
}
```

허용값은 `AI`, `TEMPLATE`다.

## 개인정보 금지 필드

매칭 응답에 다음 필드를 포함하면 안 된다.

- `email`
- 전화번호·연락처
- 학과, 학생 유형, 자기소개
- 상대의 개별 `preferredSlots`
- 상대의 개별 `effectiveSlots`
- 상대 수업의 `courseName`, `location`, `startTime`, `endTime`
- 전체 시간표

## 프론트 Mock 상태

1. 추천 3명과 다음 cursor
2. 추천 0명 + `NO_MATCHING_USERS`
3. 프로필 미완성 `409`
4. 유효 가능 시간 없음 `409`
5. 추천 카드 조회 중 상대 조건 변경 `409`
6. `summarySource: TEMPLATE` 폴백
