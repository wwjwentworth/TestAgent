import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ArtifactKind, EventBatch, SessionCompletionInput, SessionCreateInput } from "@bug-agent/event-schema";
import type { ArtifactMetadata, RecordingSessionRecord, SessionEvidence } from "../domain/session.js";

const validId = /^[a-zA-Z0-9-]{1,80}$/;
const artifactFiles: Record<ArtifactKind, string> = {
  video: "video.webm",
  "start-screenshot": "start.png",
  "end-screenshot": "end.png",
  evidence: "evidence.json",
};

export class SessionStore {
  constructor(private readonly rootDir: string) {}

  async create(input: SessionCreateInput): Promise<RecordingSessionRecord> {
    this.assertId(input.id);
    const existing = await this.tryRead(input.id);
    if (existing) return existing;
    const now = new Date().toISOString();
    const record: RecordingSessionRecord = { ...input, status: "recording", eventCount: 0, artifacts: [], createdAt: now, updatedAt: now };
    await mkdir(this.directory(input.id), { recursive: true });
    await this.write(record);
    return record;
  }

  async appendEvents(id: string, batch: EventBatch): Promise<RecordingSessionRecord> {
    const record = await this.read(id);
    if (record.status === "completed") throw new Error("SESSION_ALREADY_COMPLETED");
    const events = await this.readEvents(id);
    events.push(...batch.events);
    await this.writeJson(join(this.directory(id), "events.json"), events);
    return this.update({ ...record, status: "uploading", eventCount: events.length });
  }

  async saveArtifact(id: string, kind: ArtifactKind, mimeType: string, stream: Readable): Promise<ArtifactMetadata> {
    const record = await this.read(id);
    if (record.status === "completed") throw new Error("SESSION_ALREADY_COMPLETED");
    const fileName = artifactFiles[kind];
    const target = join(this.directory(id), fileName);
    const temporary = `${target}.uploading`;
    try { await pipeline(stream, createWriteStream(temporary)); await rename(temporary, target); }
    catch (error) { await rm(temporary, { force: true }); throw error; }
    const file = await stat(target);
    const artifact: ArtifactMetadata = { kind, mimeType, size: file.size, path: `/api/v1/sessions/${id}/artifacts/${kind}`, createdAt: new Date().toISOString() };
    await this.update({ ...record, status: "uploading", artifacts: [...record.artifacts.filter((item) => item.kind !== kind), artifact] });
    return artifact;
  }

  async complete(id: string, input: SessionCompletionInput): Promise<RecordingSessionRecord> {
    const record = await this.read(id);
    const artifacts = await this.discoverVideo(id, record.artifacts);
    if (!artifacts.some((item) => item.kind === "video")) throw new Error("VIDEO_ARTIFACT_REQUIRED");
    return this.update({ ...record, ...input, status: "completed", artifacts });
  }

  async get(id: string): Promise<SessionEvidence> { const record = await this.read(id); return { ...record, events: await this.readEvents(id) }; }

  async openArtifact(id: string, kind: ArtifactKind) {
    this.assertId(id);
    const record = await this.read(id);
    const artifact = record.artifacts.find((item) => item.kind === kind);
    if (!artifact) throw Object.assign(new Error("ARTIFACT_NOT_FOUND"), { code: "ENOENT" });
    return { ...artifact, stream: createReadStream(join(this.directory(id), artifactFiles[kind])) };
  }

  private async discoverVideo(id: string, artifacts: ArtifactMetadata[]) {
    if (artifacts.some((item) => item.kind === "video")) return artifacts;
    try {
      const file = await stat(join(this.directory(id), "video.webm"));
      return [...artifacts, { kind: "video" as const, mimeType: "video/webm", size: file.size, path: `/api/v1/recordings/${id}/video`, createdAt: new Date().toISOString() }];
    } catch { return artifacts; }
  }

  private async readEvents(id: string) { try { return JSON.parse(await readFile(join(this.directory(id), "events.json"), "utf8")); } catch { return []; } }
  private async tryRead(id: string): Promise<RecordingSessionRecord | undefined> { try { return await this.read(id); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; } }
  private async read(id: string): Promise<RecordingSessionRecord> { this.assertId(id); return JSON.parse(await readFile(join(this.directory(id), "session.json"), "utf8")); }
  private async update(record: RecordingSessionRecord) { const updated = { ...record, updatedAt: new Date().toISOString() }; await this.write(updated); return updated; }
  private async write(record: RecordingSessionRecord) { await this.writeJson(join(this.directory(record.id), "session.json"), record); }
  private async writeJson(path: string, value: unknown) { const temporary = `${path}.writing`; await writeFile(temporary, JSON.stringify(value, null, 2), "utf8"); await rename(temporary, path); }
  private directory(id: string) { return join(this.rootDir, id); }
  private assertId(id: string) { if (!validId.test(id)) throw new Error("INVALID_SESSION_ID"); }
}
