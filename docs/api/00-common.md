# 공통 API 규약

## 1. 기본 규약

| 항목 | 값 |
|---|---|
| Base URL | `/api/v1` |
| Content-Type | `application/json; charset=utf-8` |
| JSON 필드 | `camelCase` |
| URL | 복수 명사, `kebab-case` |
| 시간대 | `Asia/Seoul` |
| 시간 단위 | 30분 |

## 2. 인증

P0는 Supabase Auth, Clerk 등 외부 인증 서비스를 우선 사용한다. 백엔드는 인증 제공자가 발급한 Token을 검증하고 현재 사용자 ID를 얻는다.

```http
Authorization: Bearer <provider-access-token>
Accept: application/json
```

- 인증 누락·만료·위조는 `401 AUTH_REQUIRED` 또는 `401 AUTH_TOKEN_INVALID`다.
- URL과 Body의 사용자 ID를 현재 사용자로 신뢰하지 않는다.
- 공개 회원가입, Refresh Token과 다기기 세션 API는 P0 범위가 아니다.

## 3. 성공 응답

### 단일 리소스

```json
{
  "data": {
    "id": "resource_01"
  }
}
```

### 목록

```json
{
  "data": [],
  "meta": {
    "hasNext": false,
    "nextCursor": null
  }
}
```

빈 목록은 `null`이 아니라 `[]`다.

## 4. 오류 응답

정본의 `code`, `message`, `fieldErrors` 형식을 사용한다.

```json
{
  "code": "VALIDATION_ERROR",
  "message": "입력값을 확인해 주세요.",
  "fieldErrors": [
    {
      "field": "startTime",
      "reason": "종료 시각보다 빨라야 합니다."
    }
  ],
  "requestId": "req_01JZ9H7A2MC7PDKQ0VDQ1BW5WQ"
}
```

`fieldErrors`가 없으면 `[]`를 반환한다. `requestId`는 서버 추적용이다.

### 공통 상태 코드

| Status | 의미 |
|---:|---|
| `200` | 조회·수정·상태 변경 성공 |
| `201` | 생성 성공, `Location` 헤더 포함 |
| `204` | 삭제 성공, Body 없음 |
| `400` | JSON·쿼리 형식 오류 |
| `401` | 인증 실패 |
| `403` | 인증됐지만 권한 없음 |
| `404` | 리소스 없음 또는 소유권 없음 |
| `409` | 중복·시간·상태 충돌 |
| `422` | 의미상 유효하지 않은 입력 |
| `429` | 요청 제한 초과 |
| `500` | 내부 오류 |

## 5. 날짜와 시간

| 의미 | 형식 | 예시 |
|---|---|---|
| timestamp | ISO 8601 UTC | `2026-08-16T06:10:00Z` |
| 만남 날짜 | `YYYY-MM-DD` | `2026-08-17` |
| 반복 시각 | `HH:mm` | `12:30` |
| 요일 | enum | `MONDAY` |

요일 enum:

```text
MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY
```

시간 구간은 `[start, end)`로 해석한다. `12:00~13:00`과 `13:00~14:00`은 겹치지 않는다.

```text
overlap = startA < endB AND startB < endA
```

- 반복 시간표와 선호 시간은 요일·시각으로 저장한다.
- 제안은 특정 날짜·시각으로 저장한다.
- 제안 날짜의 요일에 해당하는 공통 가능 시간을 검증한다.
- 공휴일·휴강·시험기간 예외는 P0에서 반영하지 않는다.

## 6. ID와 enum

- 모든 ID는 문자열이며 프론트는 길이와 생성 방식을 가정하지 않는다.
- enum은 `UPPER_SNAKE_CASE` 문자열이다.
- 알 수 없는 enum 입력은 `422 VALIDATION_ERROR`다.

## 7. 목록 페이지네이션

매칭과 제안 목록은 cursor 방식이다.

```http
GET /api/v1/matches?limit=20&cursor=<opaque>
```

| Query | 기본값 | 범위 |
|---|---:|---|
| `limit` | `20` | `1~50` |
| `cursor` | 없음 | 서버가 발급한 opaque 문자열 |

## 8. 개인정보 금지

다른 사용자를 포함한 응답에 다음을 넣지 않는다.

- 이메일, 연락처, 인증 Token
- `passwordHash`
- 상대의 과목명과 강의실
- 상대의 전체 수업 목록과 전체 선호 시간
- 카드 공개 동의가 없는 학과·학생 유형·자기소개
