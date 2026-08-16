# Appointment View API

## 목적

P0는 별도 Appointment 엔티티와 전용 endpoint를 만들지 않는다. `MeetingProposal`이 날짜·시간·장소·참여자·상태의 단일 원본이며, 상태가 `ACCEPTED`인 제안을 약속 탭에서 조회한다.

## 결정 사항

```text
MeetingProposal.PENDING
→ 상대가 수락
→ MeetingProposal.ACCEPTED
→ 약속 탭에 표시
```

- 수락 시 Appointment 레코드를 생성하지 않는다.
- 약속 ID는 Proposal ID와 같다.
- 약속 취소는 Proposal 상태를 `CANCELED`로 변경한다.
- 별도 `/appointments` endpoint는 제공하지 않는다.
- 상세 계약은 [07-proposals.md](./07-proposals.md)를 따른다.

## 예정 약속 조회 `[P0]`

```http
GET /api/v1/proposals?status=ACCEPTED&timeCategory=UPCOMING
```

- 시작 시각 오름차순으로 반환한다.
- 현재 사용자가 발신자 또는 수신자인 제안만 반환한다.
- 응답의 `counterpart`, 날짜·시간, 활동, 장소 snapshot을 약속 카드에 사용한다.

## 지난 약속 조회 `[P0]`

```http
GET /api/v1/proposals?status=ACCEPTED&timeCategory=PAST
```

시작 시각 내림차순으로 반환한다.

## 약속 상세 `[P0]`

```http
GET /api/v1/proposals/{proposalId}
```

다른 사용자의 제안은 `404 PROPOSAL_NOT_FOUND`를 반환한다.

## 확정 약속 취소 `[P1]`

```http
POST /api/v1/proposals/{proposalId}/cancel
```

`ACCEPTED` 상태에서는 발신자와 수신자 모두 종료 시각 전까지 취소할 수 있다. 취소 후 같은 제안의 상태가 `CANCELED`로 바뀌며 양쪽 예정 약속 목록에서 제외된다.

## 프론트 구현 기준

- 약속 화면은 별도 Appointment 타입을 만들지 말고 Proposal 응답 타입을 재사용한다.
- `status === "ACCEPTED"`인 항목만 확정 약속으로 표시한다.
- 이메일, 연락처, 학과, 학생 유형, 자기소개와 전체 시간표는 수락 후에도 표시하지 않는다.
- 장소는 Proposal에 저장된 snapshot을 사용하며 Place seed의 최신 값으로 덮어쓰지 않는다.

## 백엔드 구현 기준

- 수락 트랜잭션은 Proposal 상태만 `ACCEPTED`로 변경한다.
- 수락 전 두 사용자의 같은 날짜 `ACCEPTED` 제안 충돌을 검사한다.
- 목록 쿼리는 참여자 조건, 상태, 날짜 범위를 함께 적용한다.
- 시작 시각이 지난 `PENDING` 제안은 수락할 수 없다.

## Mock 상태

1. 예정 `ACCEPTED` 제안 1개
2. 지난 `ACCEPTED` 제안 목록
3. 예정 약속 없음
4. 추천 장소 snapshot이 있는 약속
5. 직접 입력 장소가 있는 약속
6. 다른 사용자 상세 접근 `404`
