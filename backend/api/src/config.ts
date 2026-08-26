import { readFileSync } from "node:fs";
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

export function loadEnvFileIfPresent(path: string, env: NodeJS.ProcessEnv = process.env) {
  let source: string;
  try { source = readFileSync(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
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
