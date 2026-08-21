import { SCHEMA_VERSION, type RecordedEvent, type SessionCompletionInput, type SessionCreateInput } from "@bug-agent/event-schema";

export class SessionApi {
  constructor(private readonly baseUrl: string) {}

  create(input: Omit<SessionCreateInput, "version">) {
    return this.json("/api/v1/sessions", { method: "POST", body: JSON.stringify({ version: SCHEMA_VERSION, ...input }) });
  }

  uploadEvents(sessionId: string, events: RecordedEvent[]) {
    return this.json(`/api/v1/sessions/${sessionId}/events`, { method: "POST", body: JSON.stringify({ version: SCHEMA_VERSION, events }) });
  }

  uploadArtifact(sessionId: string, kind: "start-screenshot" | "end-screenshot" | "evidence", blob: Blob, fileName: string) {
    const body = new FormData();
    body.append("artifact", blob, fileName);
    return this.json(`/api/v1/sessions/${sessionId}/artifacts?kind=${kind}`, { method: "POST", body });
  }

  complete(sessionId: string, input: Omit<SessionCompletionInput, "version">) {
    return this.json(`/api/v1/sessions/${sessionId}/complete`, { method: "POST", body: JSON.stringify({ version: SCHEMA_VERSION, ...input }) });
  }

  private async json(path: string, init: RequestInit) {
    const headers = init.body instanceof FormData ? undefined : { "content-type": "application/json" };
    const response = await fetch(new URL(path, this.baseUrl), { ...init, headers });
    if (!response.ok) throw new Error(`证据服务 HTTP ${response.status}: ${await response.text()}`);
    return response.json();
  }
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
