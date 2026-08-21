import type { FastifyPluginAsync } from "fastify";
import type { RecordingMetadata } from "../domain/recording.js";
import type { RecordingStore } from "../services/recording-store.js";

export function recordingsUploadRoute(
  store: RecordingStore,
): FastifyPluginAsync {
  return async (app) => {
    app.post<{
      Params: { recordingId: string };
      Querystring: { title?: string; pageUrl?: string };
      Reply: RecordingMetadata;
    }>("/api/v1/recordings/:recordingId/video", async (request, reply) => {
      const file = await request.file();
      if (!file)
        return reply.code(400).send({ error: "VIDEO_FILE_REQUIRED" } as never);
      if (file.mimetype !== "video/webm")
        return reply.code(415).send({ error: "VIDEO_WEBM_REQUIRED" } as never);
      const metadata = await store.save(
        request.params.recordingId,
        file.file,
        request.query,
      );
      if (file.file.truncated)
        return reply.code(413).send({ error: "VIDEO_TOO_LARGE" } as never);
      return reply.code(201).send(metadata);
    });
  };
}
