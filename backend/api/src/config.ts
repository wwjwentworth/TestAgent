import { resolve } from "node:path";

export interface ApiConfig {
  port: number;
  host: string;
  environment: string;
  databaseUrl?: string;
  redisUrl?: string;
  objectStorageEndpoint?: string;
  recordingsDir: string;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    port: Number(env.API_PORT ?? 3001),
    host: env.API_HOST ?? "0.0.0.0",
    environment: env.APP_ENV ?? "development",
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    objectStorageEndpoint: env.OBJECT_STORAGE_ENDPOINT,
    recordingsDir: env.RECORDINGS_DIR ?? resolve(process.cwd(), "data/recordings"),
  };
}
