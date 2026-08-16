# Place Recommendation API

## 목적

검증된 캠퍼스 장소 데이터에서 공통 시간, 활동, 예산과 분위기에 맞는 장소를 최대 3개 추천한다. 후보 선정과 점수는 서버 알고리즘이 담당하고 AI는 추천 이유 문구만 생성한다.

## P0 데이터 정책

- 연세대학교 신촌캠퍼스의 식당·카페 6~10개를 seed 데이터로 제공한다.
- 장소명, 카테고리, 거리, 가격대와 식사 시간은 저장 데이터만 사용한다.
- 실시간 영업 여부는 보장하지 않는다.
- LLM이 장소를 추가하거나 속성을 수정할 수 없다.
- 데이터에는 출처 표시와 마지막 확인 시각을 저장한다.

## 타입

```ts
type PlaceCategory = "RESTAURANT" | "CAFE" | "STUDY_CAFE";
type PriceRange = "LOW" | "MEDIUM" | "HIGH";
type Atmosphere = "QUICK_MEAL" | "QUIET" | "GOOD_FOR_TALKING";

type PlaceRecommendation = {
  placeId: string;
  name: string;
  category: PlaceCategory;
  walkingDistanceMeters: number;
  walkingMinutes: number;
  priceRange: PriceRange;
  atmospheres: Atmosphere[];
  averageMealMinutes: number | null;
  score: number;
  reasons: Array<{
    type: "ACTIVITY" | "BUDGET" | "ATMOSPHERE" | "DISTANCE" | "DURATION";
    label: string;
    score: number;
  }>;
  summary: string;
  summarySource: "AI" | "TEMPLATE";
  sourceLabel: string;
  verifiedAt: string;
};
```

## GET `/place-recommendations` `[P0]`

제안 작성 단계에서 조건에 맞는 장소를 추천한다.

### 인증

Bearer Token 필요

### Query Parameters

| 이름 | 타입 | 필수 | 검증 |
|---|---|---|---|
| `campusId` | string | O | 활성 캠퍼스 ID |
| `date` | string | O | `YYYY-MM-DD`, 오늘부터 28일 이내 |
| `startTime` | string | O | `HH:mm`, 30분 단위 |
| `endTime` | string | O | `HH:mm`, 시작보다 늦음 |
| `activity` | enum | O | 프로필 활동 enum |
| `budget` | enum | X | `LOW`, `MEDIUM`, `HIGH` |
| `atmosphere` | enum | X | `QUICK_MEAL`, `QUIET`, `GOOD_FOR_TALKING` |

요청 예시:

```http
GET /api/v1/place-recommendations?campusId=campus_yonsei_sinchon&date=2026-08-17&startTime=12:00&endTime=13:00&activity=LUNCH&budget=LOW&atmosphere=QUICK_MEAL
```

### 후보 필터

1. 요청 캠퍼스의 활성 장소만 조회한다.
2. `LUNCH`면 `RESTAURANT`, `CAFE`면 `CAFE`, `STUDY`면 `CAFE`·`STUDY_CAFE`를 우선한다.
3. 선택 예산과 분위기가 있으면 점수에 반영한다.
4. 만남 길이가 60분 이하이면 `walkingMinutes`와 `averageMealMinutes`를 우선 반영한다.
5. 점수, 도보 시간, 장소 ID 순으로 정렬하고 상위 3개만 반환한다.

### 장소 점수 v1

| 항목 | 점수 |
|---|---:|
| 활동 카테고리 일치 | 40점 |
| 예산 일치 | 20점 |
| 분위기 일치 | 15점 |
| 도보 5분 이하 | 20점 |
| 도보 6~10분 | 10점 |
| 60분 이하 만남에서 `QUICK_MEAL` | 20점 |

### Success `200 OK`

```json
{
  "data": [
    {
      "placeId": "place_sinchon_001",
      "name": "캠퍼스키친",
      "category": "RESTAURANT",
      "walkingDistanceMeters": 220,
      "walkingMinutes": 3,
      "priceRange": "LOW",
      "atmospheres": ["QUICK_MEAL", "GOOD_FOR_TALKING"],
      "averageMealMinutes": 25,
      "score": 115,
      "reasons": [
        {
          "type": "ACTIVITY",
          "label": "점심 식당",
          "score": 40
        },
        {
          "type": "BUDGET",
          "label": "선택한 예산과 일치",
          "score": 20
        },
        {
          "type": "ATMOSPHERE",
          "label": "빠른 식사 가능",
          "score": 15
        },
        {
          "type": "DISTANCE",
          "label": "캠퍼스에서 도보 약 3분",
          "score": 20
        },
        {
          "type": "DURATION",
          "label": "60분 공강에 적합",
          "score": 20
        }
      ],
      "summary": "공강이 60분이라 캠퍼스에서 도보 3분 거리이고 빠르게 식사할 수 있는 장소를 추천해요.",
      "summarySource": "TEMPLATE",
      "sourceLabel": "해커톤 검증 데이터",
      "verifiedAt": "2026-08-16T04:00:00Z"
    }
  ],
  "meta": {
    "limit": 3,
    "scoreVersion": "v1",
    "generatedAt": "2026-08-16T06:35:00Z"
  }
}
```

추천 결과가 1~2개면 존재하는 후보만 반환한다.

### Empty `200 OK`

장소 추천 실패는 제안 실패가 아니다.

```json
{
  "data": [],
  "meta": {
    "limit": 3,
    "scoreVersion": "v1",
    "generatedAt": "2026-08-16T06:35:00Z",
    "emptyReason": "NO_PLACE_CANDIDATES",
    "allowCustomPlace": true
  }
}
```

### Errors

| Status | code | 조건 | 프론트 처리 |
|---:|---|---|---|
| `404` | `CAMPUS_NOT_FOUND` | 캠퍼스 없음 | 캠퍼스 다시 선택 |
| `422` | `DATE_OUT_OF_RANGE` | 과거 또는 28일 초과 | 날짜 오류 표시 |
| `422` | `INVALID_TIME_RANGE` | 시간 형식·범위 오류 | 시간 오류 표시 |
| `422` | `VALIDATION_ERROR` | enum 등 입력 오류 | 필드 오류 표시 |
| `500` | `PLACE_RECOMMENDATION_FAILED` | 추천 계산 실패 | 직접 입력 전환 |

AI 추천 문구 실패는 `500`이 아니다. 템플릿 문구와 `summarySource: "TEMPLATE"`을 반환한다.

## 제안에 장소 저장

추천 장소를 선택하면 Proposal 생성 요청은 `placeSelection`을 보낸다.

```json
{
  "placeSelection": {
    "type": "RECOMMENDED",
    "placeId": "place_sinchon_001"
  }
}
```

직접 입력 시:

```json
{
  "placeSelection": {
    "type": "CUSTOM",
    "name": "학생회관 1층"
  }
}
```

서버는 추천 장소 선택 시 다음 정보를 Proposal snapshot으로 저장한다.

```ts
type ProposalPlaceSnapshot = {
  type: "RECOMMENDED" | "CUSTOM";
  placeId: string | null;
  name: string;
  category: PlaceCategory | null;
  walkingMinutes: number | null;
  priceRange: PriceRange | null;
};
```

## AI 경계

AI 입력에는 선택된 장소의 저장 데이터와 계산된 reason만 전달한다. 다음 값은 AI 출력으로 덮어쓸 수 없다.

- `placeId`, `name`, `category`
- `walkingDistanceMeters`, `walkingMinutes`
- `priceRange`, `averageMealMinutes`
- `verifiedAt`, `sourceLabel`

AI가 근거 없는 정보를 포함하면 문구를 폐기하고 서버 템플릿을 사용한다.

## 프론트 Mock 상태

1. 60분 점심, 장소 3개, 가까운 순
2. 예산·분위기 선택 결과
3. 추천 1개만 존재
4. `data: []`, `allowCustomPlace: true`
5. 서버 오류 후 직접 입력 전환
6. AI 실패와 `summarySource: TEMPLATE`
