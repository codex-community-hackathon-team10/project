import type { ApiErrorBody, ApiResponse, CreateProposalInput, Match, MatchChatResponse, Page, Proposal, ProposalStatus, Venue } from "./contracts";

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "";
const useMockApi = import.meta.env.VITE_USE_MOCK_API === "true";
let accessToken: string | null = null;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: ApiErrorBody) {
    super(body.message);
  }
}

/** 인증 SDK 연동 후 로그인 완료 시 호출합니다. */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}/api/v1${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as T | ApiErrorBody;
  if (!response.ok) throw new ApiError(response.status, payload as ApiErrorBody);
  return payload as T;
}

const mockMatch: Match = {
  userId: "user_b", nickname: "Alex", grade: "3", campus: { id: "campus_yonsei_sinchon", name: "신촌캠퍼스" },
  commonSlots: [{ dayOfWeek: "MONDAY", startTime: "12:00", endTime: "13:30", durationMinutes: 90, nextDate: "2026-08-17" }],
  commonActivities: ["LUNCH", "LANGUAGE_EXCHANGE"], commonInterests: ["MUSIC", "TRAVEL"], score: 71,
  reasons: [{ type: "COMMON_TIME", label: "공통 가능 시간 90분", score: 30 }],
  summary: "월요일 12:00~13:30에 90분 동안 만날 수 있고, 두 분 모두 점심을 선호해요.", summarySource: "TEMPLATE",
};

const mockVenues: Venue[] = [
  { id: "venue_student_hall", campusId: "campus_yonsei_sinchon", name: "학생회관 식당", category: "RESTAURANT", walkMinutes: 3, priceRange: "UNDER_10000", tags: ["QUICK_MEAL"], description: "캠퍼스 안에서 빠르게 식사할 수 있는 장소", recommendationReason: "도보 3분 거리라 짧은 공강에도 부담 없이 갈 수 있어요." },
  { id: "venue_garden_table", campusId: "campus_yonsei_sinchon", name: "가든 테이블", category: "RESTAURANT", walkMinutes: 6, priceRange: "AROUND_15000", tags: ["GOOD_FOR_TALKING"], description: "천천히 대화하기 좋은 캠퍼스 근처 식당", recommendationReason: "90분 공강에 여유 있게 식사하며 이야기하기 좋아요." },
  { id: "venue_library_cafe", campusId: "campus_yonsei_sinchon", name: "중앙도서관 카페", category: "CAFE", walkMinutes: 4, priceRange: "UNDER_10000", tags: ["RELAXED"], description: "식사 후 잠깐 쉬기 좋은 카페", recommendationReason: "식사 후에도 자연스럽게 대화를 이어갈 수 있어요." },
];

let mockProposalId = 2;
let mockProposals: Proposal[] = [
  { id: "proposal_01", role: "RECEIVED", counterpart: { id: "user_c", nickname: "서연" }, date: "2026-08-20", startTime: "12:00", endTime: "13:00", activity: "LUNCH", venue: { type: "RECOMMENDED", venueId: "venue_student_hall", name: "학생회관 식당", walkMinutes: 3, priceRange: "UNDER_10000" }, status: "PENDING", createdAt: "2026-08-16T06:40:00Z" },
];

export const api = {
  getMatches: () => useMockApi ? Promise.resolve({ data: [mockMatch], meta: { hasNext: false, nextCursor: null } } satisfies Page<Match>) : request<Page<Match>>("/matches?limit=20"),
  sendMatchChat: (message: string) => {
    if (!useMockApi) return request<ApiResponse<MatchChatResponse>>("/match-conversations/messages", { method: "POST", body: JSON.stringify({ message }) });
    return Promise.resolve({ data: { assistantMessage: "월요일 12:00~13:30에 점심을 함께할 수 있는 Alex님을 찾았어요. 장소까지 골라 제안을 보낼 수 있어요.", parsedIntent: { date: "2026-08-17", startTime: "12:00", endTime: "13:30", activity: "LUNCH", missingFields: [] }, matches: [mockMatch] } } satisfies ApiResponse<MatchChatResponse>);
  },
  getProposals: (query: { status?: string; role?: "SENT" | "RECEIVED" | "ALL" }) => {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined) as Array<[string, string]>);
    if (!useMockApi) return request<Page<Proposal>>(`/meeting-proposals?${params}`);
    const statuses = query.status?.split(",");
    const data = mockProposals.filter((proposal) => (!statuses || statuses.includes(proposal.status)) && (!query.role || query.role === "ALL" || proposal.role === query.role));
    return Promise.resolve({ data, meta: { hasNext: false, nextCursor: null } } satisfies Page<Proposal>);
  },
  getVenueRecommendations: (query: URLSearchParams) => useMockApi ? Promise.resolve({ data: mockVenues } satisfies ApiResponse<Venue[]>) : request<ApiResponse<Venue[]>>(`/venues/recommendations?${query}`),
  createProposal: (input: CreateProposalInput) => {
    if (!useMockApi) return request<ApiResponse<Proposal>>("/meeting-proposals", { method: "POST", body: JSON.stringify(input) });
    const selectedVenue = input.venue;
    let proposalVenue: Proposal["venue"];
    if (selectedVenue.type === "RECOMMENDED") {
      const venue = mockVenues.find((item) => item.id === selectedVenue.venueId)!;
      proposalVenue = { type: "RECOMMENDED", venueId: venue.id, name: venue.name, walkMinutes: venue.walkMinutes, priceRange: venue.priceRange };
    } else {
      proposalVenue = { type: "CUSTOM", name: selectedVenue.name };
    }
    const proposal: Proposal = { id: `proposal_${mockProposalId++}`, role: "SENT", counterpart: { id: input.receiverId, nickname: "Alex" }, date: input.date, startTime: input.startTime, endTime: input.endTime, activity: "LUNCH", venue: proposalVenue, status: "PENDING", createdAt: new Date().toISOString() };
    mockProposals = [proposal, ...mockProposals];
    return Promise.resolve({ data: proposal });
  },
  changeProposalStatus: (id: string, status: ProposalStatus) => {
    if (!useMockApi) return request<ApiResponse<Pick<Proposal, "id" | "status">>>(`/meeting-proposals/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    mockProposals = mockProposals.map((proposal) => proposal.id === id ? { ...proposal, status } : proposal);
    return Promise.resolve({ data: { id, status } });
  },
};
