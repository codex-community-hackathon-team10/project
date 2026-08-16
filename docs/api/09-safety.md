# Safety API

## 목적

원하지 않는 사용자를 차단하고 부적절한 사용자를 신고한다. P0-lite는 차단 생성과 매칭·신규 제안 제외만 구현한다. 차단 목록·해제와 신고는 P1이다.

## 개인정보 원칙

- 차단 여부와 신고 내용은 대상 사용자에게 공개하지 않는다.
- 차단·신고 응답에 대상 이메일, 연락처, 시간표를 포함하지 않는다.
- 신고만으로 대상 계정을 자동 정지하지 않는다.
- 운영자 검토 기능은 별도 관리자 API 범위로 이 문서에 포함하지 않는다.

## GET `/blocks` `[P1]`

내 차단 목록을 조회한다.

### 인증

Bearer Token 필요

### Query Parameters

| 이름 | 타입 | 기본값 | 제약 |
|---|---|---:|---|
| `limit` | integer | `20` | `1~50` |
| `cursor` | string | 없음 | 서버 cursor |

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "block_01JZ8K3FVNM582BA55NJPRRAHX",
      "target": {
        "userId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
        "nickname": "Alex",
        "profileImageUrl": null
      },
      "createdAt": "2026-08-16T07:10:00Z"
    }
  ],
  "meta": {
    "hasNext": false,
    "nextCursor": null
  }
}
```

## POST `/blocks` `[P0-lite]`

사용자를 차단한다.

### 인증

Bearer Token 필요

### Request Body

```json
{
  "targetUserId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H"
}
```

### Success `201 Created`

```http
Location: /api/v1/blocks/block_01JZ8K3FVNM582BA55NJPRRAHX
```

```json
{
  "data": {
    "id": "block_01JZ8K3FVNM582BA55NJPRRAHX",
    "targetUserId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
    "createdAt": "2026-08-16T07:10:00Z",
    "effects": {
      "removedFromMatches": true,
      "newProposalsBlocked": true,
      "acceptedProposalsCanceled": false
    }
  }
}
```

동일 대상이 이미 차단된 경우 새 리소스를 만들지 않고 기존 리소스를 `200 OK`로 반환한다.

### 정책

- 차단 즉시 양쪽 사용자를 서로의 추천 결과에서 제외한다.
- 양쪽의 신규 제안 생성을 금지한다.
- 대기 중 제안은 모두 `CANCELED`로 변경할 수 있다. 구현하는 경우 시스템 취소임을 내부 기록한다.
- `ACCEPTED` 제안은 자동 취소하지 않는다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `USER_NOT_FOUND` | 대상이 존재하지 않음 |
| `422` | `CANNOT_BLOCK_SELF` | 자기 자신 차단 |
| `422` | `VALIDATION_ERROR` | ID 형식 오류 |

## DELETE `/blocks/{blockId}` `[P1]`

차단을 해제한다.

### 인증

Bearer Token 필요

### Success `204 No Content`

차단 해제 후에도 과거 `SKIP`, 거절, 취소 기록은 유지된다. 차단 해제가 즉시 추천 노출을 보장하지 않는다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `BLOCK_NOT_FOUND` | 존재하지 않거나 내 차단이 아님 |

## POST `/reports` `[P1]`

사용자를 신고한다.

### 인증

Bearer Token 필요

### Request Body

```json
{
  "targetUserId": "01JZ8G1FB5Z3N8GDRP0EBWSG4H",
  "type": "NO_SHOW",
  "description": "약속 장소에 나타나지 않았어요.",
  "context": {
    "proposalId": "proposal_01JZ8HR66FQ3F6VM8FJ5V5NB40"
  }
}
```

### 필드

| 필드 | 필수 | 검증 |
|---|---|---|
| `targetUserId` | O | 자기 자신이 아닌 존재 사용자 |
| `type` | O | 아래 enum |
| `description` | X | `null` 또는 최대 500자 |
| `context.proposalId` | X | 신고자가 참여한 제안 ID. `ACCEPTED`이면 약속 신고로 처리 |

신고 유형:

```text
INAPPROPRIATE_PROFILE | HARASSMENT | SPAM | NO_SHOW | OTHER
```

`context`는 생략할 수 있다. 보내는 경우 서버는 신고자가 관련 리소스 참여자인지 검증한다.

### Success `201 Created`

```http
Location: /api/v1/reports/report_01JZ8KHQ1ZTYBKWZAY5P2BPRC4
```

```json
{
  "data": {
    "id": "report_01JZ8KHQ1ZTYBKWZAY5P2BPRC4",
    "status": "RECEIVED",
    "createdAt": "2026-08-16T07:15:00Z",
    "canBlockUser": true
  }
}
```

응답에 입력한 신고 상세나 대상의 추가 개인정보를 되돌려주지 않는다.

### Errors

| Status | code | 조건 |
|---:|---|---|
| `404` | `USER_NOT_FOUND` | 대상 없음 |
| `404` | `REPORT_CONTEXT_NOT_FOUND` | 관련 제안 없음 또는 참여자 아님 |
| `422` | `CANNOT_REPORT_SELF` | 자기 자신 신고 |
| `422` | `VALIDATION_ERROR` | 유형·설명 검증 실패 |

## 프론트 Mock 상태

1. 차단 목록 없음
2. 차단 생성·해제 성공
3. 자기 자신 차단 오류
4. 신고 접수 성공
5. 신고 필드 오류
6. 관련 약속 권한 오류
