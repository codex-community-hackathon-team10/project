import OpenAI from "openai";
import { z } from "zod";
import { ATMOSPHERES, DAYS, PRICE_RANGES, type MatchConversationIntent } from "./domain/types.js";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const intentSchema = z.object({
  date: z.string().nullable(),
  dayOfWeek: z.enum(DAYS).nullable(),
  startTime: z.string().regex(timePattern).nullable(),
  durationMinutes: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]).nullable(),
  budget: z.enum(PRICE_RANGES).nullable(),
  atmosphere: z.enum(ATMOSPHERES).nullable(),
  assistantMessage: z.string().min(1).max(240)
});

const matchRankingSchema = z.object({
  assistantMessage: z.string().min(1).max(240),
  matches: z.array(z.object({
    candidateId: z.string().min(1),
    reason: z.string().min(1).max(180),
    evidence: z.array(z.enum(["COMMON_TIME", "COMMON_ACTIVITY", "COMMON_INTEREST", "LANGUAGE_EXCHANGE"]))
  })).max(5)
});

const venueRankingSchema = z.object({
  venues: z.array(z.object({
    venueId: z.string().min(1),
    reason: z.string().min(1).max(180)
  })).max(3)
});

export type ParsedIntent = MatchConversationIntent & { assistantMessage: string };
export type AiMatchCandidate = {
  id: string;
  commonSlot: { dayOfWeek: string; startTime: string; endTime: string; durationMinutes: number };
  commonActivities: string[];
  commonInterests: string[];
  score: number;
  evidence: Array<"COMMON_TIME" | "COMMON_ACTIVITY" | "COMMON_INTEREST" | "LANGUAGE_EXCHANGE">;
};
export type AiVenueCandidate = { id: string; category: string; walkMinutes: number; priceRange: string; tags: string[]; description: string };
export type AiMatchRanking = z.infer<typeof matchRankingSchema>;
export type AiVenueRanking = z.infer<typeof venueRankingSchema>;

export interface RecommendationAi {
  isEnabled(): boolean;
  parseIntent(input: { message: string; previousIntent: MatchConversationIntent; today: string }): Promise<ParsedIntent>;
  rankMatches(input: { intent: MatchConversationIntent; candidates: AiMatchCandidate[] }): Promise<AiMatchRanking>;
  rankVenues(input: { durationMinutes: number; budget: string | null; atmosphere: string | null; candidates: AiVenueCandidate[] }): Promise<AiVenueRanking>;
}

export class DisabledRecommendationAi implements RecommendationAi {
  isEnabled(): boolean { return false; }
  async parseIntent(): Promise<ParsedIntent> { throw new Error("OpenAI API is not configured."); }
  async rankMatches(): Promise<AiMatchRanking> { throw new Error("OpenAI API is not configured."); }
  async rankVenues(): Promise<AiVenueRanking> { throw new Error("OpenAI API is not configured."); }
}

export class OpenAiRecommendationAi implements RecommendationAi {
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna") {
    this.client = new OpenAI({ apiKey, timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 6000), maxRetries: 0 });
  }

  isEnabled(): boolean { return true; }

  async parseIntent(input: { message: string; previousIntent: MatchConversationIntent; today: string }): Promise<ParsedIntent> {
    return intentSchema.parse(await this.structured("match_chat_intent", intentJsonSchema, [
      "You extract a complete lunch-matching intent from Korean chat text.",
      "Keep a previous value unless the newest message changes it. Use null only when the user has not supplied that information.",
      "Activity is always lunch and must not be returned. Date must be YYYY-MM-DD only when explicitly stated; otherwise use dayOfWeek.",
      "Duration must be 30, 60, 90, or 120 minutes. Write a concise helpful Korean assistantMessage; ask for the missing date/day, start time, or duration when needed.",
      "Do not claim that a match, venue, booking, or availability exists."
    ].join(" "), input));
  }

  async rankMatches(input: { intent: MatchConversationIntent; candidates: AiMatchCandidate[] }): Promise<AiMatchRanking> {
    return matchRankingSchema.parse(await this.structured("match_ranking", matchRankingJsonSchema, [
      "Rank only the supplied anonymous candidate IDs for a Korean campus lunch meeting.",
      "Return at most five unique candidate IDs. Use only facts in each candidate commonSlot, commonActivities, commonInterests, score, and evidence.",
      "A reason must be a concise Korean sentence supported by its evidence array. Do not invent personal details, names, locations, or availability.",
      "The assistantMessage must be concise Korean and must not name candidates."
    ].join(" "), input));
  }

  async rankVenues(input: { durationMinutes: number; budget: string | null; atmosphere: string | null; candidates: AiVenueCandidate[] }): Promise<AiVenueRanking> {
    return venueRankingSchema.parse(await this.structured("venue_ranking", venueRankingJsonSchema, [
      "Rank only the supplied vetted campus venues for a Korean lunch meeting.",
      "Return at most three unique venue IDs and a concise Korean reason for each. Reasons may use only category, walkMinutes, priceRange, tags, and description supplied for that venue.",
      "Never invent a venue, opening hours, seat availability, menu, reservation, or price."
    ].join(" "), input));
  }

  private async structured(name: string, schema: Record<string, unknown>, instructions: string, input: unknown): Promise<unknown> {
    const response = await this.client.responses.create({
      model: this.model,
      store: false,
      instructions,
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name, strict: true, schema } }
    });
    if (!response.output_text) throw new Error("OpenAI returned no structured output.");
    return JSON.parse(response.output_text) as unknown;
  }
}

export function createConfiguredRecommendationAi(): RecommendationAi {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAiRecommendationAi(apiKey) : new DisabledRecommendationAi();
}

const intentJsonSchema = {
  type: "object", additionalProperties: false, required: ["date", "dayOfWeek", "startTime", "durationMinutes", "budget", "atmosphere", "assistantMessage"],
  properties: {
    date: { type: ["string", "null"] },
    dayOfWeek: { type: ["string", "null"], enum: [...DAYS, null] },
    startTime: { type: ["string", "null"], pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
    durationMinutes: { type: ["integer", "null"], enum: [30, 60, 90, 120, null] },
    budget: { type: ["string", "null"], enum: [...PRICE_RANGES, null] },
    atmosphere: { type: ["string", "null"], enum: [...ATMOSPHERES, null] },
    assistantMessage: { type: "string", minLength: 1, maxLength: 240 }
  }
} as const;

const matchRankingJsonSchema = {
  type: "object", additionalProperties: false, required: ["assistantMessage", "matches"],
  properties: {
    assistantMessage: { type: "string", minLength: 1, maxLength: 240 },
    matches: {
      type: "array", maxItems: 5,
      items: {
        type: "object", additionalProperties: false, required: ["candidateId", "reason", "evidence"],
        properties: {
          candidateId: { type: "string", minLength: 1 },
          reason: { type: "string", minLength: 1, maxLength: 180 },
          evidence: { type: "array", items: { type: "string", enum: ["COMMON_TIME", "COMMON_ACTIVITY", "COMMON_INTEREST", "LANGUAGE_EXCHANGE"] } }
        }
      }
    }
  }
} as const;

const venueRankingJsonSchema = {
  type: "object", additionalProperties: false, required: ["venues"],
  properties: {
    venues: {
      type: "array", maxItems: 3,
      items: {
        type: "object", additionalProperties: false, required: ["venueId", "reason"],
        properties: { venueId: { type: "string", minLength: 1 }, reason: { type: "string", minLength: 1, maxLength: 180 } }
      }
    }
  }
} as const;
