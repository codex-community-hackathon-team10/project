import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./errors.js";

declare global {
  namespace Express { interface Request { currentUserId?: string } }
}

export type TokenVerifier = { verify(token: string): Promise<string> };

export class DemoTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<string> {
    // HACK: demo access tokens stand in for the verified external provider subject.
    const matched = /^demo:(user_[a-z0-9_]+)$/.exec(token);
    if (!matched) throw new ApiError(401, "AUTH_TOKEN_INVALID", "인증 토큰이 유효하지 않습니다.");
    return matched[1];
  }
}

export function requireAuth(verifier: TokenVerifier) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer ")) return next(new ApiError(401, "AUTH_REQUIRED", "인증이 필요합니다."));
    try {
      request.currentUserId = await verifier.verify(authorization.slice(7));
      next();
    } catch (error) {
      next(error instanceof ApiError ? error : new ApiError(401, "AUTH_TOKEN_INVALID", "인증 토큰이 유효하지 않습니다."));
    }
  };
}

export function currentUserId(request: Request): string {
  if (!request.currentUserId) throw new ApiError(401, "AUTH_REQUIRED", "인증이 필요합니다.");
  return request.currentUserId;
}
