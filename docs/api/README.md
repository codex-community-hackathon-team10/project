# 점심 메이트 API 명세

> 버전: v1.1
> 기준 PRD: [`PRD.md`](../PRD.md)
> 기준 기능 명세: [`LUNCH_MATE_FUNCTIONAL_SPEC.md`](../LUNCH_MATE_FUNCTIONAL_SPEC.md)
> Base URL: `/api/v1`

## 목적

프론트엔드와 백엔드가 독립적으로 구현할 수 있도록 HTTP 계약과 구현 우선순위를 고정한다. 프론트엔드는 성공·오류 예시를 Mock 응답으로 사용하고, 백엔드는 같은 경로·필드·상태 코드로 구현한다.

## 우선순위 원칙

- `P0`: 오늘 데모 경로에 반드시 필요한 API
- `P0-lite`: 최소 안전 조건을 위한 작은 구현
- `P1`: 핵심 경로 안정화 후 구현
- `P2`: 해커톤 이후 확장

P0 데모 경로:

```text
데모 로그인 → 최소 프로필 → 주간 수업 전체 저장 → 공강·선호 시간
→ 매칭 카드 → 장소 3개 추천 → 제안 → 수락 → ACCEPTED 제안 조회
```

## 계약 원칙

1. JSON 필드명은 `camelCase`, URL은 복수 명사와 `kebab-case`를 사용한다.
2. 성공은 `{ "data": ... }`, 오류는 `{ "error": ... }`를 사용한다.
3. 빈 목록은 `null`이 아니라 `[]`다.
4. 프론트는 HTTP 상태와 `error.code`로 분기한다.
5. 공강·매칭·장소 후보·충돌은 서버 알고리즘이 결정한다.
6. AI는 저장 데이터로 계산된 추천 이유 문구만 만들며 실패 시 템플릿을 사용한다.
7. `MeetingProposal`이 제안과 약속 상태의 단일 원본이다. 별도 Appointment 엔티티를 만들지 않는다.
8. 상대의 전체 시간표, 학과, 학생 유형, 자기소개, 이메일과 연락처를 추천 응답에 포함하지 않는다.

## 문서 목록

| 문서 | 담당 기능 | 우선순위 |
|---|---|---|
| [00-common.md](./00-common.md) | 공통 응답·오류·날짜·인증 규약 | P0 |
| [01-auth.md](./01-auth.md) | 데모 로그인·내 계정, 공개 가입·갱신 | P0/P1 |
| [02-reference-data.md](./02-reference-data.md) | 학교·캠퍼스·선택지 | P0 |
| [03-profile.md](./03-profile.md) | 최소 프로필과 공개 범위 | P0/P1 |
| [04-schedules.md](./04-schedules.md) | 주간 수업 전체 저장·공강 계산 | P0/P1/P2 |
| [05-availability.md](./05-availability.md) | 선호 시간·최소 만남 시간 | P0 |
| [06-matches.md](./06-matches.md) | 최소 공개 매칭 카드 | P0/P1 |
| [07-proposals.md](./07-proposals.md) | 날짜 검증·제안·수락·단일 상태 모델 | P0/P1 |
| [08-appointments.md](./08-appointments.md) | `ACCEPTED` 제안 기반 약속 뷰 | P0 |
| [09-safety.md](./09-safety.md) | 최소 차단과 신고 | P0-lite/P1 |
| [10-places.md](./10-places.md) | 검증된 후보 기반 장소 추천 | P0 |

## 엔드포인트

### P0

| Method | Path | 기능 |
|---|---|---|
| `POST` | `/auth/login` | 데모 계정 로그인 |
| `GET` | `/users/me` | 내 계정·인증 상태 |
| `GET` | `/schools` | 학교 목록 |
| `GET` | `/schools/{schoolId}/campuses` | 캠퍼스 목록 |
| `GET` | `/profile-options` | 프로필 선택지 |
| `GET` | `/users/me/profile` | 내 프로필 조회 |
| `PUT` | `/users/me/profile` | 최소 프로필 전체 저장 |
| `GET` | `/users/me/classes` | 내 주간 수업 목록 |
| `PUT` | `/users/me/classes` | 주간 수업 전체 교체 |
| `GET` | `/users/me/free-slots` | 점심 공강 계산 결과 |
| `GET` | `/users/me/availability` | 선호 시간 조회 |
| `PUT` | `/users/me/availability` | 선호 시간 전체 저장 |
| `GET` | `/matches` | 최소 공개 추천 카드 |
| `GET` | `/matches/{userId}` | 추천 상대·제안 시간 후보 |
| `GET` | `/place-recommendations` | 장소 최대 3개 추천 |
| `POST` | `/proposals` | 날짜·장소 기반 제안 생성 |
| `GET` | `/proposals` | 보낸·받은 제안 및 약속 목록 |
| `GET` | `/proposals/{proposalId}` | 제안 상세 |
| `POST` | `/proposals/{proposalId}/accept` | 재검증 후 제안 수락 |
| `POST` | `/blocks` | 사용자 차단·매칭 제외 `P0-lite` |

### P1

| Method | Path | 기능 |
|---|---|---|
| `POST` | `/auth/sign-up` | 공개 회원가입 |
| `POST` | `/auth/refresh` | Access Token 갱신 |
| `POST` | `/auth/logout` | 로그아웃 |
| `PATCH` | `/users/me/profile` | 프로필 일부 수정 |
| `POST` | `/users/me/classes` | 개별 수업 등록 |
| `PATCH` | `/users/me/classes/{classId}` | 개별 수업 수정 |
| `DELETE` | `/users/me/classes/{classId}` | 개별 수업 삭제 |
| `POST` | `/match-actions` | 관심·넘기기 |
| `POST` | `/proposals/{proposalId}/reject` | 제안 거절 |
| `POST` | `/proposals/{proposalId}/cancel` | 대기·수락 제안 취소 |
| `GET` | `/blocks` | 차단 목록 |
| `DELETE` | `/blocks/{blockId}` | 차단 해제 |
| `POST` | `/reports` | 사용자 신고 |

### P2

| Method | Path | 기능 |
|---|---|---|
| `POST` | `/users/me/schedule-imports` | OCR 분석 |
| `POST` | `/users/me/schedule-imports/{importId}/confirm` | OCR 결과 확정 |

## 프론트엔드 병렬 작업 기준

- `/api/v1`을 공통 prefix로 사용한다.
- P0 인증은 Access Token만 저장하고 `401`이면 데모 로그인 화면으로 이동한다.
- P1 Refresh Token이 구현되면 `401 AUTH_TOKEN_EXPIRED`에 갱신을 한 번만 시도한다.
- 페이지마다 `loading`, `success`, `empty`, `error` 상태를 구현한다.
- 장소 추천 실패 화면에는 항상 직접 장소 입력을 제공한다.
- `409` 상태 충돌을 받으면 제안 상세와 목록을 다시 조회한다.
- 약속 탭은 `GET /proposals?status=ACCEPTED`를 사용한다.

## 백엔드 병렬 작업 기준

- 사용자 소유 리소스는 인증 사용자 ID로 조회한다.
- 제안 생성과 수락 모두 주간 공통 시간과 같은 날짜의 `ACCEPTED` 제안 충돌을 검사한다.
- 수락 시 별도 Appointment 레코드를 생성하지 않는다.
- 장소 후보는 seed 데이터와 점수로 정하고 AI 출력으로 후보를 추가하지 않는다.
- 추천 장소 선택 시 장소 표시 정보를 Proposal snapshot으로 저장한다.
- 차단 관계는 양방향 추천 필터와 신규 제안 검증에 적용한다.
- 제안 상태 변경은 트랜잭션으로 원자 처리한다.

## 계약 변경 절차

1. 이 문서와 해당 기능 문서를 먼저 수정한다.
2. 프론트·백엔드 담당자가 변경을 확인한다.
3. 기존 필드 삭제·이름·타입 변경은 양쪽 합의 없이 하지 않는다.
4. 양쪽 구현과 Mock 데이터를 함께 갱신한다.
