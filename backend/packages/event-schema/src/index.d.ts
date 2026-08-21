export const SCHEMA_VERSION: 1;
export const SESSION_STATUSES: readonly SessionStatus[];
export const EVENT_SOURCES: readonly EventSource[];
export const EVENT_TYPES: readonly string[];
export const ARTIFACT_KINDS: readonly ArtifactKind[];
export type SessionStatus = "recording" | "uploading" | "completed" | "failed";
export type EventSource = "action" | "console" | "exception" | "network";
export type ArtifactKind = "video" | "start-screenshot" | "end-screenshot" | "evidence";
export interface RecordedEvent { timestamp: number; source: EventSource; type: string; data: Record<string, unknown>; }
export interface SessionCreateInput { version: typeof SCHEMA_VERSION; id: string; startedAt: number; title?: string; pageUrl?: string; projectId?: string; }
export interface EventBatch { version: typeof SCHEMA_VERSION; events: RecordedEvent[]; }
export interface SessionCompletionInput { version: typeof SCHEMA_VERSION; endedAt: number; reason?: string; }
export function isRecordedEvent(value: unknown): value is RecordedEvent;
export function isSessionCreateInput(value: unknown): value is SessionCreateInput;
export function isEventBatch(value: unknown): value is EventBatch;
export function isSessionCompletionInput(value: unknown): value is SessionCompletionInput;
export function isArtifactKind(value: unknown): value is ArtifactKind;
export function assertSchema<T>(predicate: (value: unknown) => value is T, value: unknown, code?: string): T;
