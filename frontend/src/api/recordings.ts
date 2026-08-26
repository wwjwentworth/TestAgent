export interface Recording {
  id: string;
  title?: string;
  pageUrl?: string;
  mimeType: "video/webm";
  size: number;
  createdAt: string;
  videoUrl: string;
}
export interface RecordedEvent {
  timestamp: number;
  source: "action" | "console" | "exception" | "network";
  type: string;
  data: Record<string, unknown>;
}
export interface ScriptExecution {
  id: string;
  status: "running" | "passed" | "failed" | "timed_out";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  output?: string;
  error?: string;
  screenshotUrl?: string;
}
export interface BugReport {
  id: string;
  description: string;
  generatedAt: string;
  provider: string;
  model: string;
  title: string;
  summary: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  expectedBehavior: string;
  actualBehavior: string;
  stepsToReproduce: string[];
  probableCause: string;
  recommendations: string[];
  evidence: string[];
}
export interface SessionDetail {
  id: string;
  title?: string;
  pageUrl?: string;
  status: string;
  eventCount: number;
  events: RecordedEvent[];
  script?: {
    language: "javascript";
    source: string;
    generatedAt: string;
    updatedAt: string;
  };
  bugReport?: BugReport;
  executions?: ScriptExecution[];
  lastExecution?: ScriptExecution;
}

export const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

export async function listRecordings(
  signal?: AbortSignal,
): Promise<Recording[]> {
  const response = await fetch(`${apiBaseUrl}/api/v1/recordings`, { signal });
  if (!response.ok)
    throw new Error(`加载录制列表失败：HTTP ${response.status}`);
  const payload = (await response.json()) as { items: Recording[] };
  return payload.items;
}

export function recordingVideoUrl(recording: Recording): string {
  return `${apiBaseUrl}${recording.videoUrl}`;
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok)
    throw new Error(
      `请求失败：HTTP ${response.status} ${await response.text()}`,
    );
  return response.json() as Promise<T>;
}
export function getSession(id: string, signal?: AbortSignal) {
  return request<SessionDetail>(`/api/v1/sessions/${id}`, {
    signal,
    cache: "no-store",
  });
}
export function saveScript(id: string, source: string) {
  return request<SessionDetail>(`/api/v1/sessions/${id}/script`, {
    method: "PUT",
    body: JSON.stringify({ source }),
  });
}
export function deleteScript(id: string) {
  return request<SessionDetail>(`/api/v1/sessions/${id}/script`, {
    method: "DELETE",
  });
}
export function regenerateScript(id: string) {
  return request<SessionDetail>(`/api/v1/sessions/${id}/script/regenerate`, {
    method: "POST",
    body: "{}",
  });
}
export async function deleteSession(id: string) {
  const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${id}`, {
    method: "DELETE",
  });
  if (!response.ok)
    throw new Error(
      `删除任务失败：HTTP ${response.status} ${await response.text()}`,
    );
}
export function saveEvents(id: string, events: RecordedEvent[]) {
  return request<SessionDetail>(`/api/v1/sessions/${id}/events`, {
    method: "PUT",
    body: JSON.stringify({ version: 1, events }),
  });
}
export function runScript(id: string) {
  return request<ScriptExecution>(`/api/v1/sessions/${id}/script/run`, {
    method: "POST",
    body: "{}",
  });
}
export function analyzeBug(id: string, description: string) {
  return request<BugReport>(`/api/v1/sessions/${id}/bug-analysis`, {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}
export function absoluteApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}
