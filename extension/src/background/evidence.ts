import type { EvidenceEvent } from "../domain/recording";
const sensitiveHeaders = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
]);
const sensitiveQueryNames =
  /token|secret|password|passwd|authorization|session|cookie|key/i;
export function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const name of [...url.searchParams.keys()])
      if (sensitiveQueryNames.test(name))
        url.searchParams.set(name, "[REDACTED]");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function redactHeaders(
  headers: Record<string, unknown> = {},
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      sensitiveHeaders.has(name.toLowerCase()) ? "[REDACTED]" : value,
    ]),
  );
}

export function toEvidenceEvent(
  method: string,
  params: Record<string, unknown>,
): EvidenceEvent | null {
  const timestamp = Date.now();
  if (method === "Runtime.consoleAPICalled")
    return {
      timestamp,
      source: "console",
      type: String(params.type ?? "log"),
      data: { args: params.args ?? [] },
    };
  if (method === "Runtime.exceptionThrown")
    return {
      timestamp,
      source: "exception",
      type: "exception",
      data: { details: params.exceptionDetails ?? {} },
    };
  if (method === "Network.requestWillBeSent") {
    const request = params.request as Record<string, unknown> | undefined;
    return request
      ? {
        timestamp,
        source: "network",
        type: "request",
        data: {
          requestId: params.requestId,
          method: request.method,
          url: redactUrl(String(request.url ?? "")),
          headers: redactHeaders(request.headers as Record<string, unknown>),
        },
      }
      : null;
  }
  if (method === "Network.responseReceived") {
    const response = params.response as Record<string, unknown> | undefined;
    return response
      ? {
        timestamp,
        source: "network",
        type: "response",
        data: {
          requestId: params.requestId,
          url: redactUrl(String(response.url ?? "")),
          status: response.status,
          mimeType: response.mimeType,
          headers: redactHeaders(response.headers as Record<string, unknown>),
        },
      }
      : null;
  }
  if (method === "Network.loadingFailed")
    return {
      timestamp,
      source: "network",
      type: "failed",
      data: { requestId: params.requestId, errorText: params.errorText },
    };
  return null;
}
