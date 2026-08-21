import type { FastifyPluginAsync } from "fastify";
import type { RecordingStore } from "../services/recording-store.js";

export function recordingsVideoRoute(store: RecordingStore): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { recordingId: string } }>("/api/v1/recordings/:recordingId/video", async (request, reply) => {
      try {
        const video = await store.openVideo(request.params.recordingId);
        const range = parseRange(request.headers.range, video.size);
        reply.header("accept-ranges", "bytes").type("video/webm");
        if (!range) return reply.header("content-length", video.size).send(video.stream());
        return reply.code(206).header("content-range", `bytes ${range.start}-${range.end}/${video.size}`).header("content-length", range.end - range.start + 1).send(video.stream(range.start, range.end));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return reply.code(404).send({ error: "RECORDING_NOT_FOUND" });
        throw error;
      }
    });
  };
}

function parseRange(value: string | undefined, size: number) {
  if (!value) return undefined;
  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!match) return undefined;
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : undefined;
}
