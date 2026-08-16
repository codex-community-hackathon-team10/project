# 백엔드 통합 런북

## 통합 순서

1. A가 skeleton을 `backend`에 먼저 병합한다.
2. B가 최신 `backend`를 rebase한다.
3. B의 fake CoreQueryPort를 실제 구현으로 교체한다.
4. B를 `backend`에 병합한다.
5. migration, seed, test, smoke test를 clean clone에서 실행한다.

## 데모 seed

### 사용자

- A: 월요일 `12:00~14:00`, 최소 60분, 신촌, `LUNCH`
- B: 월요일 `12:00~13:30`, 최소 60분, 신촌, `LUNCH`
- C: 다른 캠퍼스 또는 공통 시간 없음

### 장소

- 학생회관 식당: 도보 3분, `QUICK_MEAL`
- 캠퍼스 앞 덮밥집: 도보 6분
- 카페: 도보 4분

장소는 팀이 실제 존재와 표시 정보를 확인한다.

## Smoke test

1. A로 인증한다.
2. 프로필·매칭 선호를 저장한다.
3. 수업을 등록하고 월요일 공강을 확인한다.
4. 선호 시간을 저장한다.
5. B가 추천되고 C가 제외되는지 확인한다.
6. 60분 점심 장소 추천에서 학생회관 식당이 우선인지 확인한다.
7. 추천 장소로 B에게 제안한다.
8. B가 제안을 수락한다.
9. 양쪽 `GET /meeting-proposals?status=ACCEPTED`에서 같은 정보를 확인한다.

## 필수 실패 테스트

| 상황 | 기대 code |
|---|---|
| 겹치는 수업 | `SCHEDULE_TIME_OVERLAP` |
| 유효 시간 없음 | `NO_EFFECTIVE_AVAILABILITY` |
| 공통 시간 밖 제안 | `TIME_NOT_IN_COMMON_SLOT` |
| 확정 약속 충돌 | `ACCEPTED_PROPOSAL_CONFLICT` |
| 동일 상대·시간 중복 | `DUPLICATE_PENDING_PROPOSAL` |
| 같은 날짜 세 번째 상대 | `DAILY_PROPOSAL_LIMIT_REACHED` |
| 권한 없는 상태 변경 | `PROPOSAL_STATUS_CHANGE_FORBIDDEN` |
| 동시 수락 | 하나 성공, 하나 `PROPOSAL_STATUS_CONFLICT` |
| 장소 후보 없음 | `200`, 빈 배열, 직접 입력 허용 |

## 병합 체크리스트

- [ ] 정본과 API 경로가 일치한다.
- [ ] 오류가 `code`, `message`, `fieldErrors` 형식이다.
- [ ] migration과 seed가 재실행 가능하다.
- [ ] 상대 시간표 상세가 응답과 로그에 없다.
- [ ] P0는 `LUNCH` 제안만 허용한다.
- [ ] Appointment 모델이 없다.
- [ ] AI·외부 장소 API 없이 데모가 동작한다.
- [ ] clean clone에서 실행된다.
