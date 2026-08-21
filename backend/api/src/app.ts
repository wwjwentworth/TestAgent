import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { loadConfig } from "./config.js";
import { registerRoutes } from "./routes/index.js";

export interface AppOptions {
  recordingsDir?: string;
}

export async function createApp(
  options: AppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  await app.register(cors, {
    origin: (origin, callback) =>
      callback(
        null,
        !origin ||
        origin === "http://localhost:3000" ||
        origin.startsWith("chrome-extension://"),
      ),
    credentials: true,
  });
  await app.register(multipart, {
    limits: { files: 1, fileSize: 250 * 1024 * 1024 },
  });

  await app.register(registerRoutes, {
    recordingsDir: options.recordingsDir ?? loadConfig().recordingsDir,
  });
  return app;
}
