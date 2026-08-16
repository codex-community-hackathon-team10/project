# API 명세 인덱스

> API 버전: v1
> Base URL: `/api/v1`
> 유일한 기능 정본: [`docs/funtiondalspec.md`](../funtiondalspec.md)

## 정본 원칙

`docs/funtiondalspec.md`가 제품 범위, 우선순위와 기능 규칙의 유일한 정본이다. 이 디렉터리는 정본을 프론트엔드·백엔드가 구현할 수 있는 HTTP 계약으로 구체화한다.

충돌 시 적용 순서:

1. `docs/funtiondalspec.md`
2. `docs/api/*.md`
3. 코드와 Mock 데이터

정본에 없는 기능을 API 문서만 보고 P0에 추가하지 않는다.

## 문서 목록

| 문서 | 범위 |
|---|---|
| [00-common.md](./00-common.md) | 공통 응답, 오류, 인증, 날짜·시간 |
| [01-profile.md](./01-profile.md) | 기준 데이터, 프로필, 매칭 선호 |
| [02-schedules.md](./02-schedules.md) | 수업 CRUD, 공강, 선호 시간 |
| [03-matches.md](./03-matches.md) | 추천 필터·점수·카드 |
| [04-venues.md](./04-venues.md) | 사전 검수 장소 추천 |
| [05-meeting-proposals.md](./05-meeting-proposals.md) | 제안 생성·조회·상태 변경·약속 뷰 |

## P0 엔드포인트

### 기준 데이터·프로필

| Method | Path | 기능 |
|---|---|---|
| `GET` | `/schools` | 학교 목록 |
| `GET` | `/schools/{schoolId}/campuses` | 캠퍼스 목록 |
| `GET` | `/profile-options` | 프로필 선택지 |
| `GET` | `/me/profile` | 내 프로필 조회 |
| `PUT` | `/me/profile` | 내 프로필 전체 저장 |
| `GET` | `/me/match-preferences` | 매칭 선호 조회 |
| `PUT` | `/me/match-preferences` | 발견 허용·최소 시간 저장 |

### 시간표·가능 시간

| Method | Path | 기능 |
|---|---|---|
| `GET` | `/me/schedules` | 내 수업 목록 |
| `POST` | `/me/schedules` | 수업 등록 |
| `PATCH` | `/me/schedules/{scheduleId}` | 수업 수정 |
| `DELETE` | `/me/schedules/{scheduleId}` | 수업 삭제 |
| `GET` | `/me/free-times` | 계산된 공강 조회 |
| `GET` | `/me/availability` | 선호·유효 가능 시간 조회 |
| `PUT` | `/me/availability` | 선호 시간 전체 저장 |

### 추천·장소·제안

| Method | Path | 기능 |
|---|---|---|
| `GET` | `/matches` | 공통 공강 메이트 추천 |
| `GET` | `/venues/recommendations` | 장소 최대 3개 추천 |
| `POST` | `/meeting-proposals` | 점심 만남 제안 생성 |
| `GET` | `/meeting-proposals` | 받은·보낸 제안과 약속 조회 |
| `PATCH` | `/meeting-proposals/{proposalId}/status` | 수락·거절·취소 |

## P0 제외

- 자체 회원가입·Access/Refresh Token·다기기 세션 API
- 차단·신고 API
- 시간표 OCR
- 실제 장소 검색 API
- `LUNCH` 외 만남 제안
- 별도 Appointment 엔티티와 `/appointments` API

## 프론트엔드 구현 규칙

- 인증 SDK에서 받은 Access Token을 `Authorization: Bearer`로 전달한다.
- `error.code`와 HTTP 상태로 분기한다.
- 각 화면에 loading, success, empty, error 상태를 구현한다.
- 장소 추천 실패 시 직접 장소 입력을 계속 제공한다.
- 약속 탭은 `GET /meeting-proposals?status=ACCEPTED`를 사용한다.
- 상대의 전체 시간표를 클라이언트에서 재구성하거나 추측하지 않는다.

## 백엔드 구현 규칙

- 인증 제공자의 Token을 서버에서 검증하고 현재 사용자 ID를 확정한다.
- 공강, 매칭, 장소 순위와 충돌 검사는 서버 규칙으로 계산한다.
- 제안 생성과 수락 시 확정 약속 충돌을 모두 검사한다.
- 같은 날짜에 서로 다른 최대 2명에게만 `PENDING` 또는 `ACCEPTED` 제안을 유지할 수 있게 한다.
- `MeetingProposal`이 약속 상태의 단일 원본이다.
- AI는 추천 이유만 다듬으며 실패 시 템플릿을 반환한다.
