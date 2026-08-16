import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly fieldErrors: { field: string; reason: string }[] = []) {
    super(message);
  }
}

export const asyncRoute = (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown> | unknown) => (request: Request, response: Response, next: NextFunction) => Promise.resolve(handler(request, response, next)).catch(next);

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  const requestId = request.header("x-request-id") ?? crypto.randomUUID();
  if (error instanceof ZodError) {
    response.status(422).json({ code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요.", fieldErrors: error.issues.map((issue) => ({ field: issue.path.join("."), reason: issue.message })), requestId });
    return;
  }
  if (error instanceof ApiError) {
    response.status(error.status).json({ code: error.code, message: error.message, fieldErrors: error.fieldErrors, requestId });
    return;
  }
  console.error({ requestId, error });
  response.status(500).json({ code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", fieldErrors: [], requestId });
}
