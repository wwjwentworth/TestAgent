import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from '../src/app.js';

test('GET /health returns API status', async (context) => {
  const app = await createApp(); context.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok', service: 'api' });
});

test("upload, list and stream a recording", async (context) => {
  const recordingsDir = await mkdtemp(join(tmpdir(), "bug-agent-recordings-"));
  const app = await createApp({ recordingsDir });
  context.after(async () => { await app.close(); await rm(recordingsDir, { recursive: true, force: true }); });
  const boundary = "----bug-agent-test";
  const video = Buffer.from("fake-webm-video");
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="recording.webm"\r\nContent-Type: video/webm\r\n\r\n`),
    video,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const upload = await app.inject({ method: "POST", url: "/api/v1/recordings/session-1/video?title=Checkout", headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload });
  assert.equal(upload.statusCode, 201);
  assert.equal(upload.json().id, "session-1");

  const list = await app.inject({ method: "GET", url: "/api/v1/recordings" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().items.length, 1);

  const range = await app.inject({ method: "GET", url: "/api/v1/recordings/session-1/video", headers: { range: "bytes=0-3" } });
  assert.equal(range.statusCode, 206);
  assert.equal(range.body, "fake");
});

test('GET /api returns module catalog', async (context) => {
  const app = await createApp(); context.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/api' });
  const payload = response.json();
  assert.equal(payload.name, 'bug-agent-api');
  assert.ok(payload.modules.includes('sessions'));
  assert.ok(payload.modules.includes('agents'));
});

test("session ingestion stores validated events and artifacts", async (context) => {
  const recordingsDir = await mkdtemp(join(tmpdir(), "bug-agent-session-"));
  const app = await createApp({ recordingsDir });
  context.after(async () => { await app.close(); await rm(recordingsDir, { recursive: true, force: true }); });
  const sessionId = "session-evidence-1";
  const create = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { version: 1, id: sessionId, startedAt: 1700000000000, title: "Checkout", pageUrl: "https://example.test/checkout" } });
  assert.equal(create.statusCode, 201);
  assert.equal(create.json().status, "recording");
  const invalid = await app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/events`, payload: { version: 1, events: [{ type: "click" }] } });
  assert.equal(invalid.statusCode, 400);
  const events = await app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/events`, payload: { version: 1, events: [{ timestamp: 1700000000100, source: "action", type: "click", data: { target: { testId: "buy" } } }] } });
  assert.equal(events.statusCode, 200);
  assert.equal(events.json().eventCount, 1);
  for (const [kind, mimeType, content] of [["start-screenshot", "image/png", "png-start"], ["end-screenshot", "image/png", "png-end"], ["evidence", "application/json", "{}"]]) {
    const artifact = await app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/artifacts?kind=${kind}`, headers: { "content-type": "multipart/form-data; boundary=artifact-boundary" }, payload: multipart("artifact-boundary", "artifact", String(kind), String(mimeType), String(content)) });
    assert.equal(artifact.statusCode, 201);
  }
  const beforeVideo = await app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/complete`, payload: { version: 1, endedAt: 1700000001000 } });
  assert.equal(beforeVideo.statusCode, 409);
  const video = await app.inject({ method: "POST", url: `/api/v1/recordings/${sessionId}/video`, headers: { "content-type": "multipart/form-data; boundary=video-boundary" }, payload: multipart("video-boundary", "video", "video.webm", "video/webm", "fake-video") });
  assert.equal(video.statusCode, 201);
  const complete = await app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/complete`, payload: { version: 1, endedAt: 1700000001000 } });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.json().status, "completed");
  assert.equal(complete.json().artifacts.length, 4);
  const detail = await app.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}` });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().events.length, 1);
  assert.equal(detail.json().artifacts.some((item: { kind: string }) => item.kind === "video"), true);
  const screenshot = await app.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}/artifacts/start-screenshot` });
  assert.equal(screenshot.statusCode, 200);
  assert.equal(screenshot.body, "png-start");
});

function multipart(boundary: string, field: string, filename: string, mimeType: string, content: string) {
  return Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`), Buffer.from(content), Buffer.from(`\r\n--${boundary}--\r\n`)]);
}
