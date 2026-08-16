# Auth API

## 목적

자체 이메일·비밀번호 인증 계약을 정의한다. P0는 사전 생성된 데모 계정 로그인과 내 계정 조회만 구현한다. 공개 회원가입, Refresh Token, 로그아웃과 학교 이메일 인증은 P1이다.

## 해커톤 인증 정책

- P0 계정은 팀이 사전 생성하고 `DEMO_VERIFIED` 상태로 저장한다.
- `DEMO_VERIFIED`와 `SCHOOL_EMAIL_VERIFIED`만 매칭·제안을 이용할 수 있다.
- `UNVERIFIED`는 프로필 편집까지만 허용한다.
- P0 Access Token은 데모 세션을 위해 최대 4시간 유효하다.
- 공개 회원가입과 학교 이메일 도메인 인증은 P1이다.

## 공통 타입

### AuthTokens

```ts
type AuthTokens = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};
```

P0는 Access Token만 사용한다. P1 Refresh Token은 응답 Body가 아닌 HttpOnly 쿠키로 설정한다.

### AccountSummary

```ts
type AccountSummary = {
  id: string;
  email: string;
  profileStatus: "INCOMPLETE" | "COMPLETE";
  verificationStatus: "DEMO_VERIFIED" | "SCHOOL_EMAIL_VERIFIED" | "UNVERIFIED";
  createdAt: string;
};
```

## POST `/auth/sign-up` `[P1]`

회원가입 후 즉시 인증 세션을 생성한다.

### 인증

불필요

### Request Body

```json
{
  "email": "minji@example.com",
  "password": "lunchmate123",
  "passwordConfirmation": "lunchmate123",
  "termsAccepted": true,
  "privacyAccepted": true
}
```

| 필드 | 타입 | 필수 | 검증 |
|---|---|---|---|
| `email` | string | O | 이메일 형식, 앞뒤 공백 제거 후 소문자화, 최대 254자 |
| `password` | string | O | 8~72자, 영문·숫자 각각 1자 이상 |
| `passwordConfirmation` | string | O | `password`와 동일 |
| `termsAccepted` | boolean | O | `true`만 허용 |
| `privacyAccepted` | boolean | O | `true`만 허용 |

### Success `201 Created`

Header:

```http
Location: /api/v1/users/me
Set-Cookie: refreshToken=<opaque>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth
```

Body:

```json
{
  "data": {
    "account": {
      "id": "01JZ8A1F01A9H9M4RNB8N4M88M",
      "email": "minji@example.com",
      "profileStatus": "INCOMPLETE",
      "verificationStatus": "UNVERIFIED",
      "createdAt": "2026-08-16T04:30:00Z"
    },
    "tokens": {
      "accessToken": "<access-token>",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  }
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `409` | `EMAIL_ALREADY_EXISTS` | 정규화된 이메일이 이미 존재 |
| `422` | `VALIDATION_ERROR` | 이메일·비밀번호·동의 검증 실패 |
| `429` | `RATE_LIMITED` | 가입 시도 제한 초과 |

비밀번호 불일치 예시:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해 주세요.",
    "details": [
      {
        "field": "passwordConfirmation",
        "reason": "비밀번호가 일치하지 않습니다."
      }
    ],
    "requestId": "req_01JZ8A3A2BB0EKVKHAJ1N5Y8YM"
  }
}
```

## POST `/auth/login` `[P0]`

이메일과 비밀번호로 인증한다.

### 인증

불필요

### Request Body

```json
{
  "email": "minji@example.com",
  "password": "lunchmate123"
}
```

### Success `200 OK`

회원가입과 같은 `account`, `tokens`를 반환하고 Refresh Token 쿠키를 설정한다.

```json
{
  "data": {
    "account": {
      "id": "01JZ8A1F01A9H9M4RNB8N4M88M",
      "email": "minji@example.com",
      "profileStatus": "COMPLETE",
      "verificationStatus": "DEMO_VERIFIED",
      "createdAt": "2026-08-16T04:30:00Z"
    },
    "tokens": {
      "accessToken": "<access-token>",
      "tokenType": "Bearer",
      "expiresIn": 14400
    }
  }
}
```

### Errors

| Status | code | 조건 |
|---:|---|---|
| `401` | `INVALID_CREDENTIALS` | 이메일이 없거나 비밀번호가 불일치 |
| `403` | `ACCOUNT_RESTRICTED` | 이용 제한 계정 |
| `429` | `RATE_LIMITED` | 로그인 시도 제한 초과 |

계정 존재 여부가 노출되지 않도록 이메일 없음과 비밀번호 불일치에 같은 응답을 사용한다.

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "이메일 또는 비밀번호를 확인해 주세요.",
    "requestId": "req_01JZ8A6DXC8GDNCQE5FZS0P42H"
  }
}
```

## POST `/auth/refresh` `[P1]`

Refresh Token 쿠키로 새 Access Token을 발급한다.

### 인증

Refresh Token 쿠키 필요. Bearer Token은 불필요하다.

### Request Body

없음

### Success `200 OK`

```json
{
  "data": {
    "accessToken": "<new-access-token>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

서버가 Refresh Token rotation을 사용하면 새 Refresh Token 쿠키도 함께 설정한다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `401` | `REFRESH_TOKEN_REQUIRED` | 쿠키 없음 |
| `401` | `REFRESH_TOKEN_INVALID` | 만료·폐기·위조된 토큰 |

갱신 실패 시 서버는 Refresh Token 쿠키를 만료시킨다.

## POST `/auth/logout` `[P1]`

현재 Refresh Token을 폐기하고 쿠키를 제거한다.

### 인증

Bearer Token 필요. Refresh Token 쿠키가 없어도 멱등적으로 성공할 수 있다.

### Request Body

없음

### Success `204 No Content`

```http
Set-Cookie: refreshToken=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth
```

Body 없음.

## GET `/users/me` `[P0]`

현재 인증 계정과 화면 라우팅에 필요한 요약 정보를 반환한다.

### 인증

Bearer Token 필요

### Success `200 OK`

```json
{
  "data": {
    "id": "01JZ8A1F01A9H9M4RNB8N4M88M",
    "email": "minji@example.com",
    "profileStatus": "COMPLETE",
    "verificationStatus": "DEMO_VERIFIED",
    "nickname": "민지",
    "profileImageUrl": null,
    "school": {
      "id": "school_yonsei",
      "name": "연세대학교"
    },
    "campus": {
      "id": "campus_yonsei_sinchon",
      "name": "신촌캠퍼스"
    },
    "createdAt": "2026-08-16T04:30:00Z"
  }
}
```

프로필 미완성 사용자는 프로필 관련 필드를 `null`로 반환한다.

```json
{
  "data": {
    "id": "01JZ8A1F01A9H9M4RNB8N4M88M",
    "email": "minji@example.com",
    "profileStatus": "INCOMPLETE",
    "verificationStatus": "UNVERIFIED",
    "nickname": null,
    "profileImageUrl": null,
    "school": null,
    "campus": null,
    "createdAt": "2026-08-16T04:30:00Z"
  }
}
```

### Errors

공통 `401` 오류를 사용한다.

## 프론트 상태 전이

```text
login 성공
├─ profileStatus = INCOMPLETE → /onboarding/profile
├─ profileStatus = COMPLETE, verificationStatus = UNVERIFIED → /verification
└─ profileStatus = COMPLETE, 인증 완료 → /matches

보호 API 401 AUTH_TOKEN_EXPIRED
├─ P0 → 인증 상태 제거 → /login
└─ P1 → refresh 1회 → 성공 시 원 요청 1회 재시도, 실패 시 /login
```
