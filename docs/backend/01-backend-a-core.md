# Backend A 지침 — Core & Availability

## 1. 미션

Backend B가 추천·제안 기능을 구현할 수 있도록 실행 가능한 서버 뼈대와 사용자·시간 데이터를 제공한다. A의 최종 산출물은 `인증된 사용자 + 유효 가능 시간 + 차단 여부`를 안정적으로 조회할 수 있는 core다.

## 2. 소유 영역

```text
common
auth
reference
profile
schedule
availability
block
core DB migration/seed
root build/config
```

## 3. 구현 endpoint

| 순서 | Method | Path | 완료 조건 |
|---:|---|---|---|
| 1 | `POST` | `/api/v1/auth/login` | 데모 계정 로그인과 Access Token 반환 |
| 2 | `GET` | `/api/v1/users/me` | profile·verification 상태 반환 |
| 3 | `GET` | `/api/v1/schools` | seed 학교 목록 |
| 4 | `GET` | `/api/v1/schools/{schoolId}/campuses` | 해당 학교 캠퍼스 목록 |
| 5 | `GET` | `/api/v1/profile-options` | enum·선택지 반환 |
| 6 | `GET` | `/api/v1/users/me/profile` | 본인 전체 프로필 |
| 7 | `PUT` | `/api/v1/users/me/profile` | 최소 프로필 전체 저장 |
| 8 | `GET` | `/api/v1/users/me/classes` | 주간 수업 목록 |
| 9 | `PUT` | `/api/v1/users/me/classes` | 전체 교체, 원자적 검증 |
| 10 | `GET` | `/api/v1/users/me/free-slots` | 11:00~15:00 공강 계산 |
| 11 | `GET` | `/api/v1/users/me/availability` | 선호·유효 가능 시간 |
| 12 | `PUT` | `/api/v1/users/me/availability` | 선호 전체 저장·교집합 반환 |
| 13 | `POST` | `/api/v1/blocks` | 최소 차단 생성 |

## 4. 첫 10분 산출물

Backend B가 기다리지 않도록 다음 뼈대를 가장 먼저 커밋한다.

1. 애플리케이션 실행점과 `/health`
2. 공통 성공 envelope `{ data }`
3. 공통 오류 envelope `{ error: { code, message, details?, requestId } }`
4. 인증 사용자 context
5. core model 이름과 repository interface
6. 테스트 실행 명령

권장 첫 커밋:

```text
chore: bootstrap backend skeleton
```

이 커밋을 빠르게 `backend`에 합치거나 B가 cherry-pick할 수 있게 commit SHA를 전달한다.

## 5. 데이터 소유권

### A 소유 테이블·컬렉션

```text
users
profiles
schools
campuses
classes
availabilities
preferred_slots
blocks
```

### 필수 제약

- `users.email`: 정규화 후 unique
- `profiles.nickname`: unique
- `classes`: `userId` index
- `preferred_slots`: `userId`, `dayOfWeek` index
- `blocks`: `(blockerUserId, blockedUserId)` unique
- 자기 자신 차단 금지
- 수업·선호 시간은 시작 < 종료

## 6. 데모 seed

최소 다음 사용자를 만든다.

```text
demo-a@example.com / DEMO_VERIFIED
demo-b@example.com / DEMO_VERIFIED
demo-c@example.com / DEMO_VERIFIED, 다른 캠퍼스 또는 공통 시간 없음
```

- 비밀번호는 환경변수 또는 seed 전용 기본값을 해시해 저장한다.
- seed를 여러 번 실행해도 중복 생성되지 않아야 한다.
- README에 데모 이메일과 비밀번호를 명확히 적되 운영 비밀번호로 재사용하지 않는다.

## 7. 공강 계산 구현

공강 계산은 순수 함수로 먼저 구현한다.

```text
입력: 특정 요일의 수업 구간들
서비스 구간: [11:00, 15:00)
출력: 서비스 구간에서 수업 합집합을 뺀 30분 이상 구간
```

절차:

1. 시간을 분으로 변환한다.
2. 같은 요일 수업을 시작 시간순으로 정렬한다.
3. 겹치거나 인접한 수업을 병합한다.
4. 서비스 구간과 교차하는 부분만 사용한다.
5. 서비스 구간에서 수업 구간을 뺀다.
6. 요청 `minimumMinutes`보다 짧은 구간을 제거한다.
7. `HH:mm`로 변환해 반환한다.

필수 테스트:

| 입력 | 기대 결과 |
|---|---|
| 수업 없음 | `11:00~15:00` |
| `10:00~12:00`, `14:00~16:00` | `12:00~14:00` |
| `11:00~15:00` | 빈 배열 |
| `12:00~13:00`, `13:00~14:00` | `11:00~12:00`, `14:00~15:00` |
| 겹친 수업 | 저장 `409 CLASS_TIME_OVERLAP` |

## 8. 유효 가능 시간

`effectiveSlots = freeSlots ∩ preferredSlots`를 서버에서 계산한다.

- 같은 요일끼리만 교차한다.
- 양쪽 경계가 같은 것은 충돌하지 않는다.
- 최소 만남 시간 미만 구간은 제거한다.
- Backend B가 DB 세부 구조를 몰라도 `getEffectiveSlots(userId)`로 조회할 수 있어야 한다.

## 9. 인증과 학생 상태

P0는 공개 회원가입과 Refresh Token을 구현하지 않는다.

- 사전 생성된 데모 계정만 로그인한다.
- Access Token 최대 유효 시간은 4시간이다.
- 비밀번호는 해시로 비교한다.
- 인증 middleware는 `userId`, `verificationStatus`를 request context에 넣는다.
- `UNVERIFIED`는 프로필 API까지만 허용한다.
- 매칭·제안은 B가 `getVerifiedUser` 또는 공통 guard로 확인한다.

## 10. Backend B에 제공할 port

구현 언어에 맞는 interface로 제공한다.

```ts
type UserMatchProjection = {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  grade: "1" | "2" | "3" | "4" | "OTHER";
  schoolId: string;
  campusId: string;
  campusName: string;
  activities: string[];
  interests: string[];
  minimumMeetingMinutes: number;
  verificationStatus: string;
};

interface CoreQueryPort {
  getVerifiedUser(userId: string): Promise<UserMatchProjection>;
  listCampusCandidates(campusId: string, excludeUserId: string): Promise<UserMatchProjection[]>;
  getEffectiveSlots(userId: string): Promise<TimeSlot[]>;
  isBlocked(userId: string, targetUserId: string): Promise<boolean>;
}
```

projection에 이메일, 학과, 학생 유형, 자기소개, 수업명과 강의실을 넣지 않는다.

## 11. 금지 사항

- P1 endpoint를 먼저 구현하지 않는다.
- 공강 계산을 Controller 또는 LLM에 넣지 않는다.
- 다른 사용자의 전체 시간표를 반환하는 repository method를 노출하지 않는다.
- Backend B 소유의 match/place/proposal 파일을 수정하지 않는다.
- 오류를 빈 성공 배열로 삼키지 않는다.

## 12. 완료 체크리스트

- [ ] 서버가 깨끗한 환경에서 실행된다.
- [ ] 데모 계정 로그인이 된다.
- [ ] core seed가 멱등적이다.
- [ ] 프로필 GET/PUT이 계약과 일치한다.
- [ ] 수업 전체 교체가 일부 저장 없이 동작한다.
- [ ] 공강 순수 함수 테스트가 통과한다.
- [ ] 선호 시간과 유효 가능 시간 계산이 통과한다.
- [ ] 차단 생성 후 `isBlocked`가 양방향 추천 제외에 사용할 값을 반환한다.
- [ ] B가 사용할 CoreQueryPort가 구현되어 있다.
- [ ] 비밀번호·전체 시간표가 로그에 남지 않는다.
