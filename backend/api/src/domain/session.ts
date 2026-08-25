import type { ArtifactKind, RecordedEvent, SessionStatus } from "@bug-agent/event-schema";

export interface ArtifactMetadata {
  kind: ArtifactKind;
  mimeType: string;
  size: number;
  path: string;
  createdAt: string;
}

export interface RecordingSessionRecord {
  version: 1;
  id: string;
  status: SessionStatus;
  startedAt: number;
  endedAt?: number;
  title?: string;
  pageUrl?: string;
  projectId?: string;
  reason?: string;
  eventCount: number;
  artifacts: ArtifactMetadata[];
  createdAt: string;
  updatedAt: string;
  script?: ReproductionScript;
  lastExecution?: ScriptExecution;
}

export interface SessionEvidence extends RecordingSessionRecord {
  events: RecordedEvent[];
}

export interface ReproductionScript { language: "javascript"; source: string; generatedAt: string; updatedAt: string; }
export interface ScriptExecution { id: string; status: "running" | "passed" | "failed" | "timed_out"; startedAt: string; finishedAt?: string; durationMs?: number; output?: string; error?: string; screenshotUrl?: string; }
