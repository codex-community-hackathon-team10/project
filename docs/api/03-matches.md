# 메이트 추천 API

## GET `/matches`

동일 학교·캠퍼스의 공통 가능 시간 기반 후보를 점수순으로 반환한다.

### 사전 조건

- 프로필이 완성돼 있다.
- 유효 가능 시간이 하나 이상이다.
- 매칭 선호가 저장돼 있다. 미저장 시 기본값을 사용한다.

### Query

| 이름 | 기본값 | 규칙 |
|---|---:|---|
| `limit` | `20` | `1~50` |
| `cursor` | 없음 | 서버 cursor |

### 후보 필터

1. 동일 학교·캠퍼스다.
2. 후보가 `isDiscoverable=true`다.
3. 자기 자신과 비활성 계정을 제외한다.
4. 차단 기능이 구현된 경우 차단 관계를 제외한다.
5. 공통 가능 시간이 존재한다.
6. 공통 시간 길이가 양쪽 최소 만남 시간 중 더 긴 값 이상이다.

### 점수 v1

| 항목 | 점수 |
|---|---:|
| 가장 긴 공통 가능 시간 | 30분당 10점, 최대 60점 |
| `LUNCH` 활동 일치 | 20점 |
| 그 외 공통 활동 | 항목당 5점, 최대 15점 |
| 공통 관심사 | 항목당 3점, 최대 15점 |
| 언어교환 조건 상호 일치 | 10점 |

총점 내림차순, 가장 긴 공통 시간, 공통 관심사 수, 사용자 ID 순으로 정렬한다.

### Success `200 OK`

```json
{
  "data": [
    {
      "userId": "user_b",
      "nickname": "Alex",
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
          "label": "공통 가능 시간 90분",
          "score": 30
        },
        {
          "type": "COMMON_ACTIVITY",
          "label": "점심·언어교환 관심 일치",
          "score": 25
        },
        {
          "type": "COMMON_INTEREST",
          "label": "관심사 2개 일치",
          "score": 6
        },
        {
          "type": "LANGUAGE_EXCHANGE",
          "label": "언어교환 조건 상호 일치",
          "score": 10
        }
      ],
      "summary": "월요일 12:00~13:30에 90분 동안 만날 수 있고, 두 분 모두 점심과 언어교환을 선호해요.",
      "summarySource": "TEMPLATE"
    }
  ],
  "meta": {
    "hasNext": false,
    "nextCursor": null,
    "scoreVersion": "v1"
  }
}
```

### Empty `200 OK`

```json
{
  "data": [],
  "meta": {
    "hasNext": false,
    "nextCursor": null,
    "emptyReason": "NO_MATCHING_USERS",
    "suggestions": [
      "선호 시간을 넓혀보세요.",
      "최소 만남 시간을 줄여보세요."
    ]
  }
}
```

### Errors

- `409 PROFILE_INCOMPLETE`
- `409 NO_EFFECTIVE_AVAILABILITY`

## 공개 정보 정책

추천 카드에는 다음만 반환한다.

- 닉네임과 학년
- 같은 캠퍼스
- 공통 가능 시간 최대 3개
- 공통 활동·관심사와 추천 이유

상대의 학과·학생 유형·자기소개는 공개 동의 기능이 구현되기 전 P0 응답에서 제외한다.

## AI 정책

- 후보 필터와 점수는 서버 규칙으로만 계산한다.
- 이 `GET /matches` API는 규칙 점수와 템플릿 이유를 사용한다. 채팅 기반 AI 재정렬은 [06-match-conversations.md](./06-match-conversations.md)를 따른다.
- AI 실패·미사용 시 템플릿과 `summarySource: TEMPLATE`을 반환한다.
- P0 만남 제안 활동은 `LUNCH`만 허용한다. 다른 활동은 공통 태그와 점수에만 사용한다.
- 채팅 기반 AI 재정렬은 [06-match-conversations.md](./06-match-conversations.md)를 따른다. 이 `GET /matches` API는 규칙 기반 폴백 및 기존 목록 조회를 유지한다.
