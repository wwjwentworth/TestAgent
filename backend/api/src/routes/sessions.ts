import type { FastifyPluginAsync } from "fastify";
import { isArtifactKind, isEventBatch, isSessionCompletionInput, isSessionCreateInput, type ArtifactKind, type EventBatch, type SessionCompletionInput, type SessionCreateInput } from "@bug-agent/event-schema";
import type { SessionStore } from "../services/session-store.js";
import { ExecutionService } from "../services/execution-service.js";

export function sessionsRoute(store: SessionStore): FastifyPluginAsync {
  return async (app) => {
    const executions = new ExecutionService(store);
    app.post<{ Body: SessionCreateInput }>("/api/v1/sessions", async (request, reply) => {
      if (!isSessionCreateInput(request.body)) return reply.code(400).send({ error: "INVALID_SESSION_SCHEMA" });
      return reply.code(201).send(await store.create(request.body));
    });
    app.post<{ Params: { sessionId: string }; Body: EventBatch }>("/api/v1/sessions/:sessionId/events", async (request, reply) => {
      if (!isEventBatch(request.body)) return reply.code(400).send({ error: "INVALID_EVENT_BATCH_SCHEMA" });
      return reply.send(await store.appendEvents(request.params.sessionId, request.body));
    });
    app.put<{ Params: { sessionId: string }; Body: EventBatch }>("/api/v1/sessions/:sessionId/events", async (request, reply) => {
      if (!isEventBatch(request.body)) return reply.code(400).send({ error: "INVALID_EVENT_BATCH_SCHEMA" });
      return reply.send(await store.replaceEvents(request.params.sessionId, request.body));
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
    app.delete<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId", async (request, reply) => {
      try { await store.deleteSession(request.params.sessionId); return reply.code(204).send(); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return reply.code(404).send({ error: "SESSION_NOT_FOUND" }); throw error; }
    });
    app.get<{ Params: { sessionId: string; kind: string } }>("/api/v1/sessions/:sessionId/artifacts/:kind", async (request, reply) => {
      if (!isArtifactKind(request.params.kind) || request.params.kind === "video") return reply.code(400).send({ error: "INVALID_ARTIFACT_KIND" });
      try { const artifact = await store.openArtifact(request.params.sessionId, request.params.kind as ArtifactKind); return reply.type(artifact.mimeType).header("content-length", artifact.size).send(artifact.stream); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return reply.code(404).send({ error: "ARTIFACT_NOT_FOUND" }); throw error; }
    });
    app.put<{ Params: { sessionId: string }; Body: { source?: unknown } }>("/api/v1/sessions/:sessionId/script", async (request, reply) => {
      if (typeof request.body?.source !== "string") return reply.code(400).send({ error: "SCRIPT_SOURCE_REQUIRED" });
      try { return reply.send(await store.saveScript(request.params.sessionId, request.body.source)); }
      catch (error) { if ((error as Error).message === "INVALID_SCRIPT") return reply.code(400).send({ error: "INVALID_SCRIPT" }); throw error; }
    });
    app.delete<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/script", async (request, reply) => {
      try { return reply.send(await store.deleteScript(request.params.sessionId)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return reply.code(404).send({ error: "SESSION_NOT_FOUND" }); throw error; }
    });
    app.post<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/script/regenerate", async (request, reply) => {
      try { return reply.send(await store.regenerateScript(request.params.sessionId)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return reply.code(404).send({ error: "SESSION_NOT_FOUND" }); throw error; }
    });
    app.post<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/script/run", async (request, reply) => {
      try { return reply.send(await executions.run(request.params.sessionId)); }
      catch (error) { if ((error as Error).message === "SCRIPT_NOT_FOUND") return reply.code(409).send({ error: "SCRIPT_NOT_FOUND" }); throw error; }
    });
    app.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/execution-screenshot", async (request, reply) => {
      try { const image = await store.openExecutionScreenshot(request.params.sessionId); return reply.type("image/png").header("content-length", image.size).send(image.stream); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return reply.code(404).send({ error: "EXECUTION_SCREENSHOT_NOT_FOUND" }); throw error; }
    });
  };
}
