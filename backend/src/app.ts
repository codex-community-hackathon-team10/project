import express from "express";
import { StoreCoreQueryPort } from "./core-query-service.js";
import type { CoreQueryPort } from "./domain/core-query-port.js";
import { createConfiguredTokenVerifier, requireAuth, type TokenVerifier } from "./http/auth.js";
import { errorHandler } from "./http/errors.js";
import { createMatchRouter } from "./http/match-routes.js";
import { createProfileRouter } from "./http/profile-routes.js";
import { createProposalRouter } from "./http/proposal-routes.js";
import { createScheduleRouter } from "./http/schedule-routes.js";
import { createVenueRouter } from "./http/venue-routes.js";
import { createSeedStore, type SocialStore } from "./store.js";

export function createApp(options: { store?: SocialStore; tokenVerifier?: TokenVerifier; coreQueryPort?: CoreQueryPort; clock?: () => Date } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (_request, response) => response.status(200).json({ data: { status: "ok" } }));
  const store = options.store ?? createSeedStore();
  const coreQueryPort = options.coreQueryPort ?? new StoreCoreQueryPort(store);
  const clock = options.clock ?? (() => new Date());
  app.use("/api/v1", requireAuth(options.tokenVerifier ?? createConfiguredTokenVerifier()), createProfileRouter(store), createScheduleRouter(store), createMatchRouter(coreQueryPort, clock), createVenueRouter(store, clock), createProposalRouter(store, coreQueryPort, clock));
  app.use(errorHandler);
  return app;
}
