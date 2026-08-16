# 기준 데이터·프로필·매칭 선호 API

## GET `/schools`

사전 등록된 활성 학교를 반환한다.

### 인증

필요

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "school_yonsei",
      "name": "연세대학교"
    }
  ]
}
```

## GET `/schools/{schoolId}/campuses`

학교에 속한 활성 캠퍼스를 반환한다.

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "campus_yonsei_sinchon",
      "schoolId": "school_yonsei",
      "name": "신촌캠퍼스",
      "timeZone": "Asia/Seoul"
    }
  ]
}
```

### Errors

- `404 SCHOOL_NOT_FOUND`

## GET `/profile-options`

프로필 입력에 사용하는 선택지를 반환한다.

### Success `200 OK`

```json
{
  "data": {
    "grades": ["1", "2", "3", "4", "OTHER"],
    "studentTypes": ["DOMESTIC", "INTERNATIONAL", "EXCHANGE", "OTHER"],
    "activities": [
      "LUNCH",
      "CAFE",
      "STUDY",
      "LANGUAGE_EXCHANGE",
      "EXERCISE",
      "HOBBY",
      "CAMPUS_TOUR",
      "MAKE_FRIENDS"
    ],
    "interests": [
      "MUSIC",
      "TRAVEL",
      "MOVIES",
      "BOOKS",
      "GAMES",
      "SPORTS",
      "FOOD",
      "CULTURE",
      "TECH",
      "CAREER"
    ],
    "minimumMeetingMinutes": [30, 60, 90, 120]
  }
}
```

## GET `/me/profile`

현재 사용자의 전체 프로필을 반환한다.

### Success `200 OK`

```json
{
  "data": {
    "userId": "user_a",
    "school": {
      "id": "school_yonsei",
      "name": "연세대학교"
    },
    "campus": {
      "id": "campus_yonsei_sinchon",
      "name": "신촌캠퍼스"
    },
    "nickname": "민지",
    "major": "컴퓨터과학과",
    "grade": "3",
    "studentType": "DOMESTIC",
    "activities": ["LUNCH", "LANGUAGE_EXCHANGE"],
    "interests": ["MUSIC", "TRAVEL"],
    "languages": {
      "speaks": ["KO"],
      "learning": ["EN"]
    },
    "isComplete": true,
    "updatedAt": "2026-08-16T06:10:00Z"
  }
}
```

### Errors

- `404 PROFILE_NOT_FOUND`: 온보딩 전

## PUT `/me/profile`

내 프로필을 전체 저장한다.

### Request Body

```json
{
  "schoolId": "school_yonsei",
  "campusId": "campus_yonsei_sinchon",
  "nickname": "민지",
  "major": "컴퓨터과학과",
  "grade": "3",
  "studentType": "DOMESTIC",
  "activities": ["LUNCH", "LANGUAGE_EXCHANGE"],
  "interests": ["MUSIC", "TRAVEL"],
  "languages": {
    "speaks": ["KO"],
    "learning": ["EN"]
  }
}
```

### 검증

- 학교·캠퍼스 관계가 유효해야 한다.
- 닉네임은 공백 제거 후 2~20자다.
- 학과·학년·학생 유형은 필수다.
- `LUNCH` 활동이 반드시 포함돼야 한다.
- 관심사는 1~10개다.
- 언어교환 선택 시 언어 정보를 입력한다.

### Success `200 OK`

GET과 동일한 전체 프로필을 반환한다.

### Errors

- `409 NICKNAME_ALREADY_EXISTS`
- `422 INVALID_SCHOOL_CAMPUS`
- `422 VALIDATION_ERROR`

## GET `/me/match-preferences`

발견 허용과 최소 만남 시간을 조회한다.

### Success `200 OK`

```json
{
  "data": {
    "isDiscoverable": true,
    "minimumMeetingMinutes": 60,
    "updatedAt": "2026-08-16T06:15:00Z"
  }
}
```

설정 전에는 기본값 `true`, `60`을 반환한다.

## PUT `/me/match-preferences`

사용자 단위 매칭 선호를 전체 저장한다.

### Request Body

```json
{
  "isDiscoverable": true,
  "minimumMeetingMinutes": 60
}
```

### Success `200 OK`

```json
{
  "data": {
    "isDiscoverable": true,
    "minimumMeetingMinutes": 60,
    "updatedAt": "2026-08-16T06:15:00Z"
  }
}
```

### 정책

- 최소 시간은 `30`, `60`, `90`, `120` 중 하나다.
- 발견 비허용 사용자는 다른 사람의 추천 후보에서 제외된다.
- 발견 비허용이어도 자신의 추천 화면은 이용할 수 있다.
