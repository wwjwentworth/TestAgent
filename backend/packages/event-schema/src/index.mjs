export const SCHEMA_VERSION = 1;
export const SESSION_STATUSES = Object.freeze(["recording", "uploading", "completed", "failed"]);
export const EVENT_SOURCES = Object.freeze(["action", "console", "exception", "network"]);
export const EVENT_TYPES = Object.freeze([
  "click", "input", "change", "select", "scroll", "navigation",
  "log", "debug", "info", "warning", "error", "exception",
  "request", "response", "failed", "error-marker",
]);
export const ARTIFACT_KINDS = Object.freeze(["video", "start-screenshot", "end-screenshot", "evidence"]);

export function isRecordedEvent(value) {
  return Boolean(isObject(value) && Number.isFinite(value.timestamp) && EVENT_SOURCES.includes(value.source) && typeof value.type === "string" && EVENT_TYPES.includes(value.type) && isObject(value.data));
}
export function isSessionCreateInput(value) {
  return Boolean(isObject(value) && value.version === SCHEMA_VERSION && isId(value.id) && Number.isFinite(value.startedAt) && optionalString(value.title) && optionalString(value.pageUrl) && optionalString(value.projectId));
}
export function isEventBatch(value) {
  return Boolean(isObject(value) && value.version === SCHEMA_VERSION && Array.isArray(value.events) && value.events.length <= 1000 && value.events.every(isRecordedEvent));
}
export function isSessionCompletionInput(value) {
  return Boolean(isObject(value) && value.version === SCHEMA_VERSION && Number.isFinite(value.endedAt) && optionalString(value.reason));
}
export function isArtifactKind(value) {
  return typeof value === "string" && ARTIFACT_KINDS.includes(value);
}
export function assertSchema(predicate, value, code = "INVALID_SCHEMA") {
  if (!predicate(value)) { const error = new TypeError(code); error.code = code; throw error; }
  return value;
}
function isObject(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function isId(value) { return typeof value === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value); }
function optionalString(value) { return value === undefined || typeof value === "string"; }
