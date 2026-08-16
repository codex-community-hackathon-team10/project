# 채팅 기반 AI 매칭 API

## POST `/match-conversations/messages`

자연어 점심 요청을 해석해 같은 캠퍼스·공통 가능 시간 조건을 만족하는 후보 중 최대 5명을 추천한다.

```json
{
  "conversationId": "optional-uuid",
  "message": "목요일 12시에 한 시간 점심 친구 찾아줘"
}
```

`conversationId`가 없으면 새 대화 세션을 만들며, 세션은 사용자별로 24시간 동안 정규화된 의도만 저장한다. 원문 채팅과 수업명·강의실은 저장하지 않는다.

### Success `200 OK`

```json
{
  "data": {
    "conversationId": "2ea0ed7f-c450-4d5b-8d33-f82d221018a2",
    "status": "MATCHES_FOUND",
    "assistantMessage": "공통 시간이 잘 맞는 메이트를 찾았어요.",
    "parsedIntent": {
      "date": "2026-08-20",
      "startTime": "12:00",
      "endTime": "13:00",
      "durationMinutes": 60,
      "activity": "LUNCH",
      "missingFields": []
    },
    "matches": [
      {
        "userId": "user_b",
        "selectedSlot": { "dayOfWeek": "THURSDAY", "startTime": "12:00", "endTime": "13:00", "durationMinutes": 60, "nextDate": "2026-08-20" },
        "summary": "목요일 점심에 한 시간 함께할 수 있어 추천해요.",
        "summarySource": "AI"
      }
    ]
  }
}
```

`NEEDS_CLARIFICATION`은 날짜/요일, 시작 시간, 만남 길이 중 필요한 정보를 묻고 빈 `matches`를 반환한다. `NO_MATCHES`는 조건을 만족하는 사용자가 없음을 뜻한다. `FALLBACK`은 AI 호출 실패 시 기존 규칙 점수 순위와 템플릿 이유를 반환한다.

## AI 및 데이터 경계

- 서버가 동일 학교·캠퍼스, 발견 허용, 공통 가능 시간, 최소 만남 시간 조건을 먼저 검증한다.
- AI에는 익명 후보 ID와 공통 시간·활동·관심사·점수 근거만 전달한다. 모델이 반환한 ID·근거는 서버가 다시 검증한다.
- 후보는 규칙 점수 상위 50명으로 제한하고 AI는 최대 5명만 재정렬한다.
- 실제 제안에는 응답의 `selectedSlot`만 사용하며, 제안 생성 시 공통 시간 검증을 다시 수행한다.
