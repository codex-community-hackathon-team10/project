import { ApiError } from "./errors.js";

type CursorPayload = { offset: number };

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    if (!Number.isSafeInteger(payload.offset) || payload.offset < 0) throw new Error("Invalid cursor");
    return payload.offset;
  } catch {
    throw new ApiError(400, "INVALID_CURSOR", "cursor 형식이 올바르지 않습니다.");
  }
}

export function page<T>(items: T[], limit: number, cursor: string | undefined): { data: T[]; meta: { hasNext: boolean; nextCursor: string | null } } {
  const offset = decodeCursor(cursor);
  const data = items.slice(offset, offset + limit);
  const hasNext = offset + data.length < items.length;
  return { data, meta: { hasNext, nextCursor: hasNext ? encodeCursor(offset + data.length) : null } };
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url");
}
