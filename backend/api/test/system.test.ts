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

test("CORS preflight allows Web console mutation requests", async (context) => {
  const app = await createApp(); context.after(() => app.close());
  for (const method of ["PUT", "DELETE"]) {
    const response = await app.inject({
      method: "OPTIONS", url: "/api/v1/sessions/session-1",
      headers: { origin: "http://localhost:3000", "access-control-request-method": method },
    });
    assert.equal(response.statusCode, 204);
    assert.match(String(response.headers["access-control-allow-methods"]), new RegExp(method));
  }
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
  const migrated = await app.inject({ method: "GET", url: "/api/v1/sessions/session-1" });
  assert.equal(migrated.statusCode, 200);
  assert.equal(migrated.json().status, "completed");
  assert.equal(migrated.json().artifacts[0].kind, "video");
  assert.match(migrated.json().script.source, /chromium\.launch/);
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
  const create = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { version: 1, id: sessionId, startedAt: 1700000000000, title: "Checkout", pageUrl: "data:text/html,<button data-testid='buy'>Buy</button>" } });
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
  assert.match(complete.json().script.source, /page\.getByTestId\("buy"\)\.click/);
  const detail = await app.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}` });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().events.length, 1);
  assert.equal(detail.json().artifacts.some((item: { kind: string }) => item.kind === "video"), true);
  const screenshot = await app.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}/artifacts/start-screenshot` });
  assert.equal(screenshot.statusCode, 200);
  assert.equal(screenshot.body, "png-start");
  const editedEvents = await app.inject({ method: "PUT", url: `/api/v1/sessions/${sessionId}/events`, payload: { version: 1, events: [{ timestamp: 1700000000200, source: "action", type: "click", data: { target: { text: "Buy" } } }] } });
  assert.equal(editedEvents.statusCode, 200);
  assert.match(editedEvents.json().script.source, /getByText\("Buy"/);
  const saveScript = await app.inject({ method: "PUT", url: `/api/v1/sessions/${sessionId}/script`, payload: { source: editedEvents.json().script.source } });
  assert.equal(saveScript.statusCode, 200);
  const run = await app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/script/run`, payload: {} });
  assert.equal(run.statusCode, 200);
  assert.equal(run.json().status, "passed", run.json().error);
  assert.ok(run.json().screenshotUrl);
  const deleted = await app.inject({ method: "DELETE", url: `/api/v1/sessions/${sessionId}/script` });
  assert.equal(deleted.statusCode, 200);
  assert.equal(deleted.json().script, undefined);
  assert.equal(deleted.json().lastExecution, undefined);
  const runDeleted = await app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/script/run`, payload: {} });
  assert.equal(runDeleted.statusCode, 409);
  const deletedScreenshot = await app.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}/execution-screenshot` });
  assert.equal(deletedScreenshot.statusCode, 404);
  const regenerated = await app.inject({ method: "POST", url: `/api/v1/sessions/${sessionId}/script/regenerate`, payload: {} });
  assert.equal(regenerated.statusCode, 200);
  assert.match(regenerated.json().script.source, /getByText\("Buy"/);
  const deletedTask = await app.inject({ method: "DELETE", url: `/api/v1/sessions/${sessionId}` });
  assert.equal(deletedTask.statusCode, 204);
  const deletedDetail = await app.inject({ method: "GET", url: `/api/v1/sessions/${sessionId}` });
  assert.equal(deletedDetail.statusCode, 404);
  const recordingsAfterDelete = await app.inject({ method: "GET", url: "/api/v1/recordings" });
  assert.equal(recordingsAfterDelete.json().items.length, 0);
});

function multipart(boundary: string, field: string, filename: string, mimeType: string, content: string) {
  return Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`), Buffer.from(content), Buffer.from(`\r\n--${boundary}--\r\n`)]);
}
