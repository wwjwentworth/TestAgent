import type { FastifyPluginAsync } from "fastify";
import { apiInfoRoute } from "./api-info.js";
import { healthRoute } from "./health.js";
import { RecordingStore } from "../services/recording-store.js";
import { recordingsListRoute } from "./recordings-list.js";
import { recordingsUploadRoute } from "./recordings-upload.js";
import { recordingsVideoRoute } from "./recordings-video.js";
import { SessionStore } from "../services/session-store.js";
import { sessionsRoute } from "./sessions.js";

interface RouteOptions {
  recordingsDir: string;
}

export const registerRoutes: FastifyPluginAsync<RouteOptions> = async (
  app,
  options,
) => {
  const store = new RecordingStore(options.recordingsDir);
  const sessionStore = new SessionStore(options.recordingsDir);
  const routes: FastifyPluginAsync[] = [
    healthRoute,
    apiInfoRoute,
    recordingsUploadRoute(store),
    recordingsListRoute(store),
    recordingsVideoRoute(store),
    sessionsRoute(sessionStore),
  ];
  for (const route of routes) await app.register(route);
};
