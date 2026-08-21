import type { FastifyPluginAsync } from "fastify";
import { isArtifactKind, isEventBatch, isSessionCompletionInput, isSessionCreateInput, type ArtifactKind, type EventBatch, type SessionCompletionInput, type SessionCreateInput } from "@bug-agent/event-schema";
import type { SessionStore } from "../services/session-store.js";

export function sessionsRoute(store: SessionStore): FastifyPluginAsync {
  return async (app) => {
    app.post<{ Body: SessionCreateInput }>("/api/v1/sessions", async (request, reply) => {
      if (!isSessionCreateInput(request.body)) return reply.code(400).send({ error: "INVALID_SESSION_SCHEMA" });
      return reply.code(201).send(await store.create(request.body));
    });
    app.post<{ Params: { sessionId: string }; Body: EventBatch }>("/api/v1/sessions/:sessionId/events", async (request, reply) => {
      if (!isEventBatch(request.body)) return reply.code(400).send({ error: "INVALID_EVENT_BATCH_SCHEMA" });
      return reply.send(await store.appendEvents(request.params.sessionId, request.body));
    });
    app.post<{ Params: { sessionId: string }; Querystring: { kind?: string } }>("/api/v1/sessions/:sessionId/artifacts", async (request, reply) => {
      if (!isArtifactKind(request.query.kind) || request.query.kind === "video") return reply.code(400).send({ error: "INVALID_ARTIFACT_KIND" });
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "ARTIFACT_FILE_REQUIRED" });
      const artifact = await store.saveArtifact(request.params.sessionId, request.query.kind as ArtifactKind, file.mimetype, file.file);
      return reply.code(201).send(artifact);
    });
    app.post<{ Params: { sessionId: string }; Body: SessionCompletionInput }>("/api/v1/sessions/:sessionId/complete", async (request, reply) => {
      if (!isSessionCompletionInput(request.body)) return reply.code(400).send({ error: "INVALID_COMPLETION_SCHEMA" });
      try { return reply.send(await store.complete(request.params.sessionId, request.body)); }
      catch (error) { if ((error as Error).message === "VIDEO_ARTIFACT_REQUIRED") return reply.code(409).send({ error: "VIDEO_ARTIFACT_REQUIRED" }); throw error; }
    });
    app.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId", async (request, reply) => {
      try { return reply.send(await store.get(request.params.sessionId)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return reply.code(404).send({ error: "SESSION_NOT_FOUND" }); throw error; }
    });
    app.get<{ Params: { sessionId: string; kind: string } }>("/api/v1/sessions/:sessionId/artifacts/:kind", async (request, reply) => {
      if (!isArtifactKind(request.params.kind) || request.params.kind === "video") return reply.code(400).send({ error: "INVALID_ARTIFACT_KIND" });
      try { const artifact = await store.openArtifact(request.params.sessionId, request.params.kind as ArtifactKind); return reply.type(artifact.mimeType).header("content-length", artifact.size).send(artifact.stream); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return reply.code(404).send({ error: "ARTIFACT_NOT_FOUND" }); throw error; }
    });
  };
}
