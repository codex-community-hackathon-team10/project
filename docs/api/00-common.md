# 공통 API 규약

## 1. 기본 정보

| 항목 | 값 |
|---|---|
| API 버전 | `v1` |
| Base URL | `/api/v1` |
| Content-Type | `application/json; charset=utf-8` |
| 인증 | P0: Bearer Access Token, P1: HttpOnly Refresh Token 쿠키 추가 |
| JSON 필드 | `camelCase` |
| URL 리소스 | 복수 명사, `kebab-case` |
| 문자 인코딩 | UTF-8 |
| 화면 기준 타임존 | `Asia/Seoul` |

파일 업로드 API만 `multipart/form-data`를 사용한다.

## 2. 공통 요청 헤더

### 인증 불필요 API

```http
Content-Type: application/json
Accept: application/json
```

### 인증 필요 API

```http
Authorization: Bearer <access-token>
Content-Type: application/json
Accept: application/json
```

P0 데모 계정 로그인은 Access Token만 사용한다. 다음 Refresh Token 요청 규약은 P1 구현 시 적용한다.

```ts
fetch("/api/v1/auth/refresh", {
  method: "POST",
  credentials: "include"
});
```

## 3. 성공 응답

### 단일 리소스

```json
{
  "data": {
    "id": "01JZ7M8JHVB2F84DJ8X1QKQW9M"
  }
}
```

### 목록 리소스

```json
{
  "data": [],
  "meta": {
    "hasNext": false,
    "nextCursor": null
  }
}
```

빈 목록은 반드시 `[]`를 반환한다.

### 본문 없는 성공

`DELETE` 성공처럼 반환할 데이터가 없으면 `204 No Content`와 빈 Body를 사용한다.

## 4. 오류 응답

모든 오류는 다음 형식을 사용한다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해 주세요.",
    "details": [
      {
        "field": "startTime",
        "reason": "종료 시간보다 빨라야 합니다."
      }
    ],
    "requestId": "req_01JZ7MCM8GPV4D2D0Q6S7H3JCA"
  }
}
```

`details`가 없을 때는 빈 배열이 아니라 필드 자체를 생략할 수 있다. `requestId`는 서버 로그 추적용이며 사용자에게 필수로 노출하지 않아도 된다.

### 공통 상태 코드

| Status | 의미 | 프론트 처리 |
|---:|---|---|
| `200` | 조회·수정·액션 성공 | 응답 반영 |
| `201` | 리소스 생성 성공 | 응답 반영, `Location` 사용 가능 |
| `204` | 삭제 성공 | 로컬 목록에서 제거 |
| `400` | JSON 파싱·쿼리 형식 오류 | 요청 구현 확인 |
| `401` | 인증 정보 없음·만료·유효하지 않음 | 갱신 1회 후 로그인 이동 |
| `403` | 인증은 됐지만 권한 없음 | 접근 불가 안내 |
| `404` | 리소스 없음 | 목록 또는 이전 화면으로 이동 |
| `409` | 중복 또는 상태 충돌 | 최신 데이터 다시 조회 |
| `422` | 의미상 유효하지 않은 입력 | 필드 오류 표시 |
| `429` | 요청 한도 초과 | `Retry-After` 이후 재시도 |
| `500` | 예상하지 못한 서버 오류 | 공통 오류 및 재시도 표시 |
| `502` | OCR·AI 등 외부 서비스 실패 | 폴백 또는 수동 입력 안내 |
| `503` | 일시적 서비스 불가 | 잠시 후 재시도 안내 |

### 공통 오류 코드

| error.code | Status | 의미 |
|---|---:|---|
| `INVALID_JSON` | `400` | Body가 유효한 JSON이 아님 |
| `INVALID_QUERY` | `400` | 쿼리 파라미터 형식 오류 |
| `VALIDATION_ERROR` | `422` | 필드 검증 실패 |
| `AUTH_REQUIRED` | `401` | Access Token 없음 |
| `AUTH_TOKEN_EXPIRED` | `401` | Access Token 만료 |
| `AUTH_TOKEN_INVALID` | `401` | Access Token 위조·형식 오류 |
| `FORBIDDEN` | `403` | 리소스 권한 없음 |
| `RESOURCE_NOT_FOUND` | `404` | 리소스 없음 |
| `STATE_CONFLICT` | `409` | 현재 상태에서 요청 처리 불가 |
| `DUPLICATE_RESOURCE` | `409` | 동일 리소스가 이미 존재 |
| `RATE_LIMITED` | `429` | 요청 한도 초과 |
| `INTERNAL_ERROR` | `500` | 내부 서버 오류 |
| `UPSTREAM_ERROR` | `502` | 외부 서비스 오류 |
| `SERVICE_UNAVAILABLE` | `503` | 일시적 서비스 불가 |

## 5. ID, 날짜와 시간

### ID

- 모든 ID는 문자열이다.
- 예시는 ULID를 사용하지만 프론트엔드는 길이나 형식을 가정하지 않는다.
- ID를 숫자로 변환하지 않는다.

### 시간 형식

| 의미 | 형식 | 예시 |
|---|---|---|
| 서버 timestamp | ISO 8601 UTC | `2026-08-16T04:30:00Z` |
| 지역 날짜 | `YYYY-MM-DD` | `2026-08-17` |
| 주간 시간표 시각 | `HH:mm` | `12:30` |
| 요일 enum | 아래 값 | `MONDAY` |

요일 enum:

```text
MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY
```

- 주간 시간표와 선호 시간은 `HH:mm`과 요일로 저장한다.
- 실제 제안과 약속은 `date`, `startTime`, `endTime`, `timeZone`을 함께 반환한다.
- MVP의 `timeZone`은 항상 `Asia/Seoul`이다.
- 종료 경계와 다음 시작 경계는 겹치지 않는다. `12:00~13:00`과 `13:00~14:00`은 충돌하지 않는다.
- 특정 날짜 제안에는 그 날짜 요일의 주간 시간표 규칙을 적용한다.
- P0는 공휴일·휴강·보강 예외를 반영하지 않는다.
- 제안 생성과 수락 시 양쪽 사용자의 같은 날짜 `ACCEPTED` 제안과 시간 충돌을 검사한다.

## 6. enum 처리

- enum은 영문 대문자 `UPPER_SNAKE_CASE` 문자열이다.
- 프론트는 표시 문구를 별도 맵으로 관리하고 enum 원문을 화면에 직접 노출하지 않는다.
- 백엔드는 알 수 없는 enum을 `null`로 바꾸지 않고 `422 VALIDATION_ERROR`를 반환한다.

## 7. 필드 생략과 null

| 상황 | 규칙 |
|---|---|
| 값이 없는 문자열 선택 필드 | `null` 반환 |
| 빈 컬렉션 | `[]` 반환 |
| PATCH에서 변경하지 않는 필드 | 요청에서 생략 |
| PATCH에서 선택값 삭제 | 명세가 허용한 필드에 `null` 전송 |
| 필수 응답 필드 | 항상 반환 |

## 8. 페이지네이션

추천, 제안, 약속, 차단 목록은 cursor 기반 페이지네이션을 사용한다.

### 요청

```http
GET /api/v1/proposals?limit=20&cursor=eyJjcmVhdGVkQXQiOiI...
```

| Query | 타입 | 기본값 | 제약 |
|---|---|---:|---|
| `limit` | integer | `20` | `1~50` |
| `cursor` | string | 없음 | 서버가 발급한 opaque 문자열 |

### 응답

```json
{
  "data": [],
  "meta": {
    "hasNext": true,
    "nextCursor": "eyJjcmVhdGVkQXQiOiI..."
  }
}
```

프론트는 cursor 내용을 해석하거나 직접 생성하지 않는다.

## 9. 정렬

- 각 목록의 기본 정렬은 기능 문서에서 고정한다.
- MVP에서는 임의 `sort` 쿼리를 제공하지 않는다.
- 같은 정렬값은 `id`를 마지막 tie-breaker로 사용해 순서를 안정화한다.

## 10. 인증·세션 처리

- P0는 사전 생성된 `DEMO_VERIFIED` 계정 로그인과 최대 4시간 Access Token만 구현한다.
- 공개 회원가입, 학교 이메일 인증과 Refresh Token은 P1이다.
- Access Token은 로그인·회원가입·갱신 응답 Body로 전달한다.
- Refresh Token은 `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` 쿠키로만 전달한다.
- 프론트 JavaScript는 Refresh Token을 읽거나 저장하지 않는다.
- P0에서 Access Token 만료 시 로그인 화면으로 이동한다.
- P1에서 Access Token 만료 시 갱신 요청은 동시에 한 번만 수행한다.
- 갱신 성공 후 실패한 원 요청을 한 번만 재시도한다.
- 갱신도 `401`이면 인증 상태를 삭제하고 로그인 화면으로 이동한다.

## 11. 요청 중복과 동시성

- 생성 버튼은 프론트에서 요청 중 비활성화한다.
- 백엔드는 회원가입, 제안 생성, 제안 수락에 데이터베이스 제약 또는 트랜잭션을 사용한다.
- 상태 전이 API가 동시에 호출되면 하나만 성공하고 나머지는 `409 STATE_CONFLICT`를 반환한다.
- 네트워크 오류 후 생성 요청 재시도 시 중복 가능성이 큰 API는 `Idempotency-Key` 헤더를 지원할 수 있다.

```http
Idempotency-Key: 9dfc0fb4-e8a5-49ba-9ed4-59059e6dc3c1
```

MVP에서 `Idempotency-Key`는 `/proposals` 생성에 권장하며 동일 사용자·동일 키는 24시간 동안 같은 결과를 반환한다.

## 12. 캐시

| API | Cache-Control |
|---|---|
| 학교·선택지 기준 데이터 | `public, max-age=3600` |
| 인증·내 정보·추천·제안·약속 | `private, no-store` |

## 13. 요청 추적과 Rate Limit

- 클라이언트가 `X-Request-Id`를 보내면 서버는 형식 검증 후 재사용하거나 새 값을 발급한다.
- 서버는 응답의 `X-Request-Id`에 최종 추적 ID를 반환한다.
- 기본 제한은 인증 사용자의 경우 사용자별 분당 100회, 비인증 API는 IP별 분당 30회다.
- 초과 응답에는 `Retry-After` 헤더를 포함한다.
