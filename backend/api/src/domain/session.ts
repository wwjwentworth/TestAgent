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
}

export interface SessionEvidence extends RecordingSessionRecord {
  events: RecordedEvent[];
}
