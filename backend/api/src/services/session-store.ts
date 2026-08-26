import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ArtifactKind, EventBatch, SessionCompletionInput, SessionCreateInput } from "@bug-agent/event-schema";
import type { ArtifactMetadata, BugReport, RecordingSessionRecord, SessionEvidence } from "../domain/session.js";
import type { ScriptExecution } from "../domain/session.js";
import { PlaywrightGenerator } from "@bug-agent/playwright-generator";

const validId = /^[a-zA-Z0-9-]{1,80}$/;
const artifactFiles: Record<ArtifactKind, string> = {
  video: "video.webm",
  "start-screenshot": "start.png",
  "end-screenshot": "end.png",
  evidence: "evidence.json",
};

export class SessionStore {
  private readonly generator = new PlaywrightGenerator();
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
    const source = this.generator.generate(record, await this.readEvents(id));
    const now = new Date().toISOString();
    await writeFile(join(this.directory(id), "reproduction.mjs"), source, "utf8");
    return this.update({ ...record, ...input, status: "completed", artifacts, script: { language: "javascript", source, generatedAt: now, updatedAt: now } });
  }

  async get(id: string): Promise<SessionEvidence> {
    const record = await this.tryRead(id) ?? await this.migrateLegacyRecording(id);
    return { ...record, events: await this.readEvents(id) };
  }

  async openArtifact(id: string, kind: ArtifactKind) {
    this.assertId(id);
    const record = await this.read(id);
    const artifact = record.artifacts.find((item) => item.kind === kind);
    if (!artifact) throw Object.assign(new Error("ARTIFACT_NOT_FOUND"), { code: "ENOENT" });
    return { ...artifact, stream: createReadStream(join(this.directory(id), artifactFiles[kind])) };
  }
  async openExecutionScreenshot(id: string, executionId?: string) {
    this.assertId(id);
    const record = await this.read(id);
    const resolvedId = executionId ?? record.lastExecution?.id;
    if (!resolvedId) throw Object.assign(new Error("EXECUTION_SCREENSHOT_NOT_FOUND"), { code: "ENOENT" });
    this.assertId(resolvedId);
    const path = join(this.directory(id), `execution-${resolvedId}.png`);
    const file = await stat(path);
    return { size: file.size, stream: createReadStream(path) };
  }

  async replaceEvents(id: string, batch: EventBatch) {
    const record = await this.read(id);
    await this.writeJson(join(this.directory(id), "events.json"), batch.events);
    const source = this.generator.generate(record, batch.events);
    const now = new Date().toISOString();
    await writeFile(join(this.directory(id), "reproduction.mjs"), source, "utf8");
    return this.update({ ...record, eventCount: batch.events.length, script: { language: "javascript", source, generatedAt: now, updatedAt: now } });
  }

  async saveScript(id: string, source: string) {
    if (!source.trim() || Buffer.byteLength(source) > 100_000) throw new Error("INVALID_SCRIPT");
    const record = await this.read(id);
    const now = new Date().toISOString();
    await writeFile(join(this.directory(id), "reproduction.mjs"), source, "utf8");
    return this.update({ ...record, script: { language: "javascript", source, generatedAt: record.script?.generatedAt ?? now, updatedAt: now } });
  }

  async regenerateScript(id: string) {
    const record = await this.read(id);
    const source = this.generator.generate(record, await this.readEvents(id));
    const now = new Date().toISOString();
    await writeFile(join(this.directory(id), "reproduction.mjs"), source, "utf8");
    return this.update({ ...record, script: { language: "javascript", source, generatedAt: now, updatedAt: now } });
  }

  async deleteScript(id: string) {
    const record = await this.read(id);
    await Promise.all([
      rm(join(this.directory(id), "reproduction.mjs"), { force: true }),
      rm(join(this.directory(id), "execution-final.png"), { force: true }),
    ]);
    await Promise.all((record.executions ?? []).map((execution) =>
      rm(join(this.directory(id), `execution-${execution.id}.png`), { force: true })
    ));
    const { script: _script, executions: _executions, lastExecution: _execution, ...remaining } = record;
    return this.update(remaining);
  }

  async deleteSession(id: string) {
    this.assertId(id);
    await stat(this.directory(id));
    await rm(this.directory(id), { recursive: true, force: false });
  }

  async saveExecution(id: string, execution: ScriptExecution) {
    const record = await this.read(id);
    const executions = record.executions ?? (record.lastExecution ? [record.lastExecution] : []);
    const existingIndex = executions.findIndex((item) => item.id === execution.id);
    const updatedExecutions = existingIndex === -1
      ? [...executions, execution]
      : executions.map((item, index) => index === existingIndex ? execution : item);
    return this.update({ ...record, executions: updatedExecutions, lastExecution: execution });
  }
  async saveBugReport(id: string, bugReport: BugReport) { const record = await this.read(id); return this.update({ ...record, bugReport }); }
  videoPath(id: string) { this.assertId(id); return join(this.directory(id), "video.webm"); }
  artifactFilePath(id: string, kind: "start-screenshot" | "end-screenshot") { this.assertId(id); return join(this.directory(id), artifactFiles[kind]); }
  scriptPath(id: string) { this.assertId(id); return join(this.directory(id), "reproduction.mjs"); }
  executionDirectory(id: string) { this.assertId(id); return this.directory(id); }

  private async discoverVideo(id: string, artifacts: ArtifactMetadata[]) {
    if (artifacts.some((item) => item.kind === "video")) return artifacts;
    try {
      const file = await stat(join(this.directory(id), "video.webm"));
      return [...artifacts, { kind: "video" as const, mimeType: "video/webm", size: file.size, path: `/api/v1/recordings/${id}/video`, createdAt: new Date().toISOString() }];
    } catch { return artifacts; }
  }

  private async migrateLegacyRecording(id: string): Promise<RecordingSessionRecord> {
    this.assertId(id);
    const directory = this.directory(id);
    const metadata = JSON.parse(await readFile(join(directory, "metadata.json"), "utf8")) as { title?: string; pageUrl?: string; createdAt?: string };
    const video = await stat(join(directory, "video.webm"));
    const createdAt = metadata.createdAt ?? new Date(video.birthtimeMs).toISOString();
    const startedAt = Date.parse(createdAt) || video.birthtimeMs;
    const source = this.generator.generate({ pageUrl: metadata.pageUrl }, []);
    const artifact: ArtifactMetadata = { kind: "video", mimeType: "video/webm", size: video.size, path: `/api/v1/recordings/${id}/video`, createdAt };
    const record: RecordingSessionRecord = {
      version: 1, id, status: "completed", startedAt, endedAt: startedAt,
      title: metadata.title, pageUrl: metadata.pageUrl, eventCount: 0,
      artifacts: [artifact], createdAt, updatedAt: new Date().toISOString(),
      script: { language: "javascript", source, generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };
    await writeFile(join(directory, "reproduction.mjs"), source, "utf8");
    await this.write(record);
    return record;
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
