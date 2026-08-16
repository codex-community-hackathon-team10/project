import express from "express";
import { createConfiguredTokenVerifier, requireAuth, type TokenVerifier } from "./http/auth.js";
import { errorHandler } from "./http/errors.js";
import { createProfileRouter } from "./http/profile-routes.js";
import { createScheduleRouter } from "./http/schedule-routes.js";
import { createSeedStore, type MemoryStore } from "./store.js";

export function createApp(options: { store?: MemoryStore; tokenVerifier?: TokenVerifier } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (_request, response) => response.status(200).json({ data: { status: "ok" } }));
  const store = options.store ?? createSeedStore();
  app.use("/api/v1", requireAuth(options.tokenVerifier ?? createConfiguredTokenVerifier()), createProfileRouter(store), createScheduleRouter(store));
  app.use(errorHandler);
  return app;
}
