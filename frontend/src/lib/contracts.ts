/** docs/api 명세를 기준으로 한 UI 전용 계약 타입입니다. */
export type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED";

export type ApiErrorBody = {
  code: string;
  message: string;
  fieldErrors: Array<{ field: string; reason: string }>;
  requestId?: string;
};

export type Page<T> = { data: T[]; meta: { hasNext: boolean; nextCursor: string | null; [key: string]: unknown } };
export type ApiResponse<T> = { data: T };
export type TimeSlot = { dayOfWeek: DayOfWeek; startTime: string; endTime: string; durationMinutes: number; nextDate?: string };

export type Match = {
  userId: string;
  nickname: string;
  grade: string;
  campus: { id: string; name: string };
  commonSlots: TimeSlot[];
  selectedSlot?: TimeSlot & { nextDate: string };
  commonActivities: string[];
  commonInterests: string[];
  score: number;
  reasons: Array<{ type: string; label: string; score: number }>;
  summary: string;
  summarySource: "AI" | "TEMPLATE";
};

export type Venue = {
  id: string;
  campusId: string;
  name: string;
  category: "RESTAURANT" | "CAFE" | "STUDY_SPACE";
  walkMinutes: number;
  priceRange: "UNDER_10000" | "AROUND_15000" | "FLEXIBLE";
  tags: string[];
  description: string;
  recommendationReason: string;
  reasonSource?: "AI" | "TEMPLATE";
};
export type Proposal = {
  id: string;
  role: "SENT" | "RECEIVED";
  counterpart: { id: string; nickname: string };
  date: string;
  startTime: string;
  endTime: string;
  activity: "LUNCH";
  venue: { type: "RECOMMENDED" | "CUSTOM"; venueId?: string; name: string; walkMinutes?: number; priceRange?: string };
  status: ProposalStatus;
  createdAt: string;
};

export type CreateProposalInput = {
  receiverId: string;
  date: string;
  startTime: string;
  endTime: string;
  activity: "LUNCH";
  venue: { type: "RECOMMENDED"; venueId: string } | { type: "CUSTOM"; name: string };
  message: string | null;
};

export type ScheduleRecord = {
  id: string;
  dayOfWeek: DayOfWeek;
  subjectName: string;
  startTime: string;
  endTime: string;
  classroom: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MatchPreference = {
  isDiscoverable: boolean;
  minimumMeetingMinutes: 30 | 60 | 90 | 120;
  updatedAt: string;
};

export type PreferredSlot = {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

export type Availability = {
  preferredSlots: PreferredSlot[];
  effectiveSlots: TimeSlot[];
  updatedAt: string;
};

export type FreeTimes = {
  serviceWindow: { startTime: string; endTime: string; timeZone: string };
  slots: TimeSlot[];
  calculatedAt: string;
};

export type Profile = {
  userId: string;
  school: { id: string; name: string };
  campus: { id: string; name: string };
  nickname: string;
  major: string;
  grade: string;
  studentType: "DOMESTIC" | "INTERNATIONAL" | "EXCHANGE" | "OTHER";
  activities: string[];
  interests: string[];
  languages: { speaks: string[]; learning: string[] };
  isComplete: boolean;
  updatedAt: string;
};

export type UpdateProfileInput = {
  schoolId: string;
  campusId: string;
  nickname: string;
  major: string;
  grade: string;
  studentType: Profile["studentType"];
  activities: string[];
  interests: string[];
  languages: Profile["languages"];
};

export type School = { id: string; name: string };
export type Campus = { id: string; schoolId: string; name: string; timeZone: string };
export type ProfileOptions = {
  grades: Array<"1" | "2" | "3" | "4" | "OTHER">;
  studentTypes: Profile["studentType"][];
  activities: string[];
  interests: string[];
  minimumMeetingMinutes: Array<30 | 60 | 90 | 120>;
};

/** AI가 자연어 요청을 파싱하고 기존 추천 규칙을 실행한 결과입니다. */
export type MatchChatIntent = {
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  activity: "LUNCH";
  budget?: Venue["priceRange"];
  atmosphere?: "QUICK_MEAL" | "GOOD_FOR_TALKING" | "RELAXED";
  missingFields: string[];
};

export type MatchChatResponse = {
  conversationId: string;
  status: "NEEDS_CLARIFICATION" | "MATCHES_FOUND" | "NO_MATCHES" | "FALLBACK";
  assistantMessage: string;
  parsedIntent: MatchChatIntent;
  matches: Match[];
};
