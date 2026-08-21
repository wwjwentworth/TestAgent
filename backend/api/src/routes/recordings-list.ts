import type { FastifyPluginAsync } from "fastify";
import type { RecordingStore } from "../services/recording-store.js";

export function recordingsListRoute(store: RecordingStore): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/v1/recordings", async () => ({ items: await store.list() }));
  };
}
