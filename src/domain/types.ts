export const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
export const ACTIVITIES = ["LUNCH", "CAFE", "STUDY", "LANGUAGE_EXCHANGE", "EXERCISE", "HOBBY", "CAMPUS_TOUR", "MAKE_FRIENDS"] as const;
export const INTERESTS = ["MUSIC", "TRAVEL", "MOVIES", "BOOKS", "GAMES", "SPORTS", "FOOD", "CULTURE", "TECH", "CAREER"] as const;
export const STUDENT_TYPES = ["DOMESTIC", "INTERNATIONAL", "EXCHANGE", "OTHER"] as const;
export const MINIMUM_MEETING_MINUTES = [30, 60, 90, 120] as const;
export const VENUE_CATEGORIES = ["RESTAURANT", "CAFE", "STUDY_SPACE"] as const;
export const PRICE_RANGES = ["UNDER_10000", "AROUND_15000", "FLEXIBLE"] as const;
export const ATMOSPHERES = ["QUICK_MEAL", "GOOD_FOR_TALKING", "RELAXED"] as const;
export const PROPOSAL_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "CANCELED"] as const;

export type DayOfWeek = (typeof DAYS)[number];
export type TimeSlot = { dayOfWeek: DayOfWeek; startTime: string; endTime: string; durationMinutes: number };
export type PreferredSlot = Omit<TimeSlot, "durationMinutes">;
export type User = { id: string; isActive: boolean };
export type Profile = { userId: string; schoolId: string; campusId: string; nickname: string; major: string; grade: string; studentType: (typeof STUDENT_TYPES)[number]; activities: string[]; interests: string[]; languages: { speaks: string[]; learning: string[] }; updatedAt: string };
export type MatchPreference = { userId: string; isDiscoverable: boolean; minimumMeetingMinutes: number; updatedAt: string };
export type Schedule = { id: string; userId: string; dayOfWeek: DayOfWeek; subjectName: string; startTime: string; endTime: string; classroom: string | null; createdAt: string; updatedAt: string };
export type School = { id: string; name: string; isActive: boolean };
export type Campus = { id: string; schoolId: string; name: string; timeZone: "Asia/Seoul"; isActive: boolean };

export type Venue = {
  id: string;
  campusId: string;
  name: string;
  category: (typeof VENUE_CATEGORIES)[number];
  walkMinutes: number;
  priceRange: (typeof PRICE_RANGES)[number];
  tags: string[];
  description: string;
  isActive: boolean;
};

export type ProposalVenue = {
  type: "RECOMMENDED" | "CUSTOM";
  venueId: string | null;
  name: string;
  walkMinutes: number | null;
  priceRange: (typeof PRICE_RANGES)[number] | null;
};

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type MeetingProposal = {
  id: string;
  senderId: string;
  receiverId: string;
  date: string;
  startTime: string;
  endTime: string;
  activity: "LUNCH";
  venue: ProposalVenue;
  message: string | null;
  status: ProposalStatus;
  createdAt: string;
  respondedAt: string | null;
  canceledBy: string | null;
};

export type UserMatchView = { userId: string; nickname: string; grade: string; schoolId: string; campusId: string; campusName: string; activities: string[]; interests: string[]; languages: { speaks: string[]; learning: string[] }; isDiscoverable: boolean; minimumMeetingMinutes: number; isActive: boolean };
