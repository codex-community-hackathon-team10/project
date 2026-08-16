# Backend A — Core Time 지침

## 미션

인증된 현재 사용자, 프로필, 매칭 선호와 유효 가능 시간을 제공해 Backend B가 추천·제안을 구현할 수 있게 한다.

## 첫 산출물

1. 실행 가능한 서버와 `/health`
2. 외부 인증 Token 검증 middleware
3. 공통 성공·오류 응답
4. DB migration·seed 명령
5. `CoreQueryPort` interface와 fake 구현
6. 테스트 명령

권장 첫 커밋:

```text
chore: bootstrap backend skeleton
```

## 소유 엔티티

```text
User
Profile
School
Campus
MatchPreference
ClassSchedule
Availability
```

## 구현 순서

1. 외부 인증 검증과 현재 사용자 mapping
2. 학교·캠퍼스·profile options seed
3. 프로필 GET/PUT
4. 매칭 선호 GET/PUT
5. 수업 GET/POST/PATCH/DELETE
6. 공강 순수 함수와 GET
7. 선호 시간 GET/PUT과 유효 가능 시간
8. CoreQueryPort 실제 구현

## 공강 함수

```text
service window: [11:00, 15:00)
free time = service window - merged class intervals
effective time = free time ∩ preferred availability
```

필수 테스트:

| 수업 | 공강 |
|---|---|
| 없음 | `11:00~15:00` |
| `10:00~12:00`, `14:00~16:00` | `12:00~14:00` |
| `11:00~15:00` | 없음 |
| `12:00~13:00`, `13:00~14:00` | `11:00~12:00`, `14:00~15:00` |

수업 저장 시 같은 요일 구간 중복은 `409 SCHEDULE_TIME_OVERLAP`이다.

## MatchPreference 규칙

- `isDiscoverable` 기본값 `true`
- `minimumMeetingMinutes` 기본값 `60`
- 허용 시간은 `30`, `60`, `90`, `120`
- 최소 시간은 Availability가 아니라 사용자 단위 설정에 저장

## B에 제공할 view

```ts
type UserMatchView = {
  userId: string;
  nickname: string;
  grade: string;
  schoolId: string;
  campusId: string;
  campusName: string;
  activities: string[];
  interests: string[];
  languages: { speaks: string[]; learning: string[] };
  isDiscoverable: boolean;
  minimumMeetingMinutes: number;
  isActive: boolean;
};
```

이 view에 이메일, 과목명, 강의실과 전체 시간표를 넣지 않는다.

## 완료 기준

- [ ] 외부 인증 Token에서 현재 사용자를 얻는다.
- [ ] 프로필 미완성 상태를 구분한다.
- [ ] 매칭 선호 기본값과 저장이 동작한다.
- [ ] 수업 CRUD 직후 공강이 갱신된다.
- [ ] 선호 구간 병합과 유효 시간 계산이 통과한다.
- [ ] CoreQueryPort를 B가 사용할 수 있다.
- [ ] 상대 시간표 상세를 노출하는 method가 없다.
