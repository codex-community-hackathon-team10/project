# Reference Data API

## 목적

학교·캠퍼스와 프로필 선택지를 프론트에 제공한다. 프론트와 백엔드가 enum 및 표시값을 별도로 추측하지 않도록 한다.

## GET `/schools`

지원 학교 목록을 조회한다.

### 인증

불필요

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `q` | string | X | 학교명 검색, 최대 50자 |

MVP 데이터가 적으므로 페이지네이션하지 않는다.

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "school_yonsei",
      "name": "연세대학교",
      "isActive": true
    }
  ]
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `400` | `INVALID_QUERY` | `q` 길이 또는 형식 오류 |

## GET `/schools/{schoolId}/campuses`

선택한 학교의 활성 캠퍼스 목록을 조회한다.

### 인증

불필요

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "campus_yonsei_sinchon",
      "schoolId": "school_yonsei",
      "name": "신촌캠퍼스",
      "timeZone": "Asia/Seoul",
      "isActive": true
    }
  ]
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `SCHOOL_NOT_FOUND` | 학교가 존재하지 않음 |

학교는 존재하지만 캠퍼스가 없으면 `200`과 빈 배열을 반환한다.

## GET `/profile-options`

프로필·활동·관심사 입력에 사용할 선택지를 한 번에 조회한다.

### 인증

불필요

### Success `200 OK`

```json
{
  "data": {
    "grades": [
      { "value": "1", "label": "1학년" },
      { "value": "2", "label": "2학년" },
      { "value": "3", "label": "3학년" },
      { "value": "4", "label": "4학년" },
      { "value": "OTHER", "label": "기타" }
    ],
    "studentTypes": [
      { "value": "DOMESTIC", "label": "재학생" },
      { "value": "INTERNATIONAL", "label": "유학생" },
      { "value": "EXCHANGE", "label": "교환학생" },
      { "value": "OTHER", "label": "기타" }
    ],
    "activities": [
      { "value": "LUNCH", "label": "같이 밥 먹기", "emoji": "🍚" },
      { "value": "CAFE", "label": "카페", "emoji": "☕" },
      { "value": "STUDY", "label": "같이 공부", "emoji": "📚" },
      { "value": "LANGUAGE_EXCHANGE", "label": "언어교환", "emoji": "🗣️" },
      { "value": "EXERCISE", "label": "운동", "emoji": "🏃" },
      { "value": "HOBBY", "label": "취미활동", "emoji": "🎮" },
      { "value": "CAMPUS_TOUR", "label": "캠퍼스 탐방", "emoji": "🚶" },
      { "value": "MAKE_FRIENDS", "label": "친구 만들기", "emoji": "💬" }
    ],
    "interests": [
      { "value": "MUSIC", "label": "음악" },
      { "value": "TRAVEL", "label": "여행" },
      { "value": "MOVIES", "label": "영화" },
      { "value": "BOOKS", "label": "독서" },
      { "value": "GAMES", "label": "게임" },
      { "value": "SPORTS", "label": "스포츠" },
      { "value": "FOOD", "label": "맛집" },
      { "value": "CULTURE", "label": "문화" },
      { "value": "TECH", "label": "IT·기술" },
      { "value": "CAREER", "label": "진로" }
    ],
    "languages": [
      { "value": "KO", "label": "한국어" },
      { "value": "EN", "label": "영어" },
      { "value": "JA", "label": "일본어" },
      { "value": "ZH", "label": "중국어" },
      { "value": "ES", "label": "스페인어" },
      { "value": "FR", "label": "프랑스어" },
      { "value": "OTHER", "label": "기타" }
    ],
    "minimumMeetingMinutes": [30, 60, 90, 120]
  }
}
```

### 캐시

```http
Cache-Control: public, max-age=3600
```

## 프론트 구현 메모

- UI 라벨과 emoji는 응답값을 우선 사용한다.
- 저장 요청에는 `label`이 아니라 `value`만 보낸다.
- 알 수 없는 `value`가 내려오면 화면 전체를 중단하지 말고 해당 항목을 안전하게 숨긴 뒤 오류를 기록한다.
