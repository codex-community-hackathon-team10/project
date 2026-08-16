# 장소 추천 API

## GET `/venues/recommendations`

사전 검수 장소 중 공통 시간과 점심 조건에 맞는 최대 3개를 반환한다.

### Query

| 이름 | 필수 | 규칙 |
|---|---|---|
| `campusId` | O | 활성 캠퍼스 ID |
| `date` | O | 미래 `YYYY-MM-DD` |
| `startTime` | O | `HH:mm`, 30분 단위 |
| `endTime` | O | 시작보다 늦음 |
| `activity` | O | P0는 `LUNCH`만 허용 |
| `budget` | X | `UNDER_10000`, `AROUND_15000`, `FLEXIBLE` |
| `atmosphere` | X | `QUICK_MEAL`, `GOOD_FOR_TALKING`, `RELAXED` |

```http
GET /api/v1/venues/recommendations?campusId=campus_yonsei_sinchon&date=2026-08-17&startTime=12:00&endTime=13:00&activity=LUNCH&budget=UNDER_10000
```

### 추천 규칙

- `LUNCH`는 식당을 우선한다.
- 60분 이하이면 도보 5분 이내와 `QUICK_MEAL` 태그를 우선한다.
- 90분 이상이면 `GOOD_FOR_TALKING` 또는 `RELAXED` 태그를 가산한다.
- 예산·분위기 입력이 있으면 일치 장소를 가산한다.
- 조건 통과 후보를 최대 3개 반환한다.
- 동점은 도보 시간, 장소 ID 순이다.

### Success `200 OK`

```json
{
  "data": [
    {
      "id": "venue_student_hall",
      "campusId": "campus_yonsei_sinchon",
      "name": "학생회관 식당",
      "category": "RESTAURANT",
      "walkMinutes": 3,
      "priceRange": "UNDER_10000",
      "tags": ["QUICK_MEAL"],
      "description": "캠퍼스 안에서 빠르게 식사할 수 있는 장소",
      "recommendationReason": "60분 공강이라 도보 3분이고 빠르게 식사할 수 있는 장소를 추천해요.",
      "reasonSource": "TEMPLATE"
    }
  ],
  "meta": {
    "limit": 3,
    "isRealTimeAvailabilityGuaranteed": false
  }
}
```

### 후보 없음 `200 OK`

```json
{
  "data": [],
  "meta": {
    "limit": 3,
    "emptyReason": "NO_VENUE_CANDIDATES",
    "allowCustomVenue": true,
    "isRealTimeAvailabilityGuaranteed": false
  }
}
```

### Errors

- `404 CAMPUS_NOT_FOUND`
- `422 INVALID_TIME_RANGE`
- `422 UNSUPPORTED_ACTIVITY`: P0에서 `LUNCH`가 아님

## 데이터와 AI 경계

- 장소명·카테고리·도보 시간·가격대·태그는 seed 데이터에서만 가져온다.
- LLM은 새 장소 또는 사실을 생성할 수 없다.
- LLM은 선택된 장소의 한 문장 이유만 다듬을 수 있다.
- 실패 시 템플릿을 사용한다.
- 실시간 영업·좌석 여부를 보장하는 필드를 반환하지 않는다.

## 장소 최소 모델

```ts
type Venue = {
  id: string;
  campusId: string;
  name: string;
  category: "RESTAURANT" | "CAFE" | "STUDY_SPACE";
  walkMinutes: number;
  priceRange: string;
  tags: string[];
  description: string;
  isActive: boolean;
};
```
