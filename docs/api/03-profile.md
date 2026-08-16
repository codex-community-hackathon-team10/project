# Profile API

## 목적

매칭에 필요한 내 기본 프로필, 활동, 관심사와 언어 정보를 조회하고 저장한다. P0는 GET과 PUT을 구현하며 PATCH와 이미지·자기소개·언어교환 세부 설정은 P1이다.

## 공개 범위

- 프로필 API는 본인에게 전체 정보를 반환한다.
- 추천 API는 닉네임, 프로필 이미지, 학년, 같은 캠퍼스, 공통 시간·활동·관심사만 반환한다.
- 학과, 학생 유형, 자기소개와 언어 세부 정보는 추천 카드에 기본 공개하지 않는다.
- 수락 후에도 이메일, 연락처와 전체 시간표는 공개하지 않는다.

## Profile 타입

```ts
type Profile = {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  bio: string | null;
  school: { id: string; name: string };
  campus: { id: string; name: string };
  department: string;
  grade: "1" | "2" | "3" | "4" | "OTHER";
  studentType: "DOMESTIC" | "INTERNATIONAL" | "EXCHANGE" | "OTHER";
  activities: Activity[];
  interests: Interest[];
  languages: {
    speaks: Language[];
    learning: Language[];
  };
  status: "COMPLETE";
  updatedAt: string;
};

type Activity =
  | "LUNCH"
  | "CAFE"
  | "STUDY"
  | "LANGUAGE_EXCHANGE"
  | "EXERCISE"
  | "HOBBY"
  | "CAMPUS_TOUR"
  | "MAKE_FRIENDS";

type Interest =
  | "MUSIC"
  | "TRAVEL"
  | "MOVIES"
  | "BOOKS"
  | "GAMES"
  | "SPORTS"
  | "FOOD"
  | "CULTURE"
  | "TECH"
  | "CAREER";

type Language = "KO" | "EN" | "JA" | "ZH" | "ES" | "FR" | "OTHER";
```

## GET `/users/me/profile` `[P0]`

내 프로필 전체를 조회한다.

### 인증

Bearer Token 필요

### Success `200 OK`

```json
{
  "data": {
    "userId": "01JZ8A1F01A9H9M4RNB8N4M88M",
    "nickname": "민지",
    "profileImageUrl": null,
    "bio": "새로운 친구와 맛집 가는 걸 좋아해요.",
    "school": {
      "id": "school_yonsei",
      "name": "연세대학교"
    },
    "campus": {
      "id": "campus_yonsei_sinchon",
      "name": "신촌캠퍼스"
    },
    "department": "컴퓨터과학과",
    "grade": "3",
    "studentType": "DOMESTIC",
    "activities": ["LUNCH", "LANGUAGE_EXCHANGE"],
    "interests": ["MUSIC", "TRAVEL"],
    "languages": {
      "speaks": ["KO"],
      "learning": ["EN"]
    },
    "status": "COMPLETE",
    "updatedAt": "2026-08-16T05:10:00Z"
  }
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `PROFILE_NOT_FOUND` | 최초 프로필 저장 전 |

## PUT `/users/me/profile` `[P0]`

최초 프로필을 생성하거나 프로필 전체를 교체한다. 모든 필수 필드를 보내야 한다.

### 인증

Bearer Token 필요

### Request Body

```json
{
  "nickname": "민지",
  "profileImageUrl": null,
  "bio": "새로운 친구와 맛집 가는 걸 좋아해요.",
  "schoolId": "school_yonsei",
  "campusId": "campus_yonsei_sinchon",
  "department": "컴퓨터과학과",
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

### 필드 검증

| 필드 | 필수 | 검증 |
|---|---|---|
| `nickname` | O | 공백 제거 후 2~20자, 금칙어 금지 |
| `profileImageUrl` | X | `null` 또는 HTTPS URL |
| `bio` | X | `null` 또는 최대 200자 |
| `schoolId` | O | 활성 학교 ID |
| `campusId` | O | 선택 학교의 활성 캠퍼스 ID |
| `department` | O | 공백 제거 후 1~50자 |
| `grade` | O | 허용 enum |
| `studentType` | O | 허용 enum |
| `activities` | O | 중복 없는 1~8개, `LUNCH` 권장 |
| `interests` | O | 중복 없는 0~10개 |
| `languages.speaks` | O | 중복 없는 0~7개 |
| `languages.learning` | O | 중복 없는 0~7개 |

`LANGUAGE_EXCHANGE`를 선택하면 `speaks`와 `learning`을 각각 1개 이상 입력해야 한다.

### Success

- 최초 생성: `201 Created`, `Location: /api/v1/users/me/profile`
- 기존 프로필 전체 교체: `200 OK`

두 경우 모두 GET과 동일한 Profile 응답을 반환한다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `409` | `NICKNAME_ALREADY_EXISTS` | 닉네임 중복 |
| `422` | `INVALID_SCHOOL_CAMPUS` | 캠퍼스가 학교 소속이 아님 |
| `422` | `LANGUAGE_INFO_REQUIRED` | 언어교환 선택 후 언어 누락 |
| `422` | `VALIDATION_ERROR` | 필드 검증 실패 |

## PATCH `/users/me/profile` `[P1]`

프로필 일부만 수정한다. 생략 필드는 유지하며 `bio`, `profileImageUrl`만 `null`로 삭제할 수 있다.

### 인증

Bearer Token 필요

### Request Body 예시

```json
{
  "bio": null,
  "activities": ["LUNCH", "CAFE"],
  "interests": ["MUSIC", "FOOD"]
}
```

### Success `200 OK`

수정된 전체 Profile을 반환한다.

### 정책

- `schoolId` 또는 `campusId` 중 하나를 변경할 때도 둘 다 보내야 한다.
- 학교·캠퍼스 변경 성공 시 기존 추천 cache를 무효화한다.
- 배열은 일부 추가가 아니라 전부 교체한다.
- 빈 Body는 `422 VALIDATION_ERROR`다.

### Errors

PUT과 같은 프로필 오류를 사용한다.

## 프론트 Mock 상태

최소 다음 응답을 준비한다.

1. 프로필 없음: `404 PROFILE_NOT_FOUND`
2. 완성된 국내 재학생 프로필
3. 언어교환 정보를 가진 교환학생 프로필
4. 닉네임 중복: `409 NICKNAME_ALREADY_EXISTS`
5. 필드 오류: `422 VALIDATION_ERROR`
