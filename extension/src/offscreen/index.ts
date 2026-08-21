import type { ExtensionMessage } from "../domain/messages";
let recorder: MediaRecorder | undefined;
let stream: MediaStream | undefined;
let chunks: Blob[] = [];
let activeSessionId: string | undefined;
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "offscreen/start") {
      void start(message.streamId, message.sessionId)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) =>
          sendResponse({ ok: false, error: String(error) }),
        );
      return true;
    }
    if (message.type === "offscreen/stop") {
      void stop(message.sessionId, message.uploadUrl)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error: unknown) =>
          sendResponse({ ok: false, error: String(error) }),
        );
      return true;
    }
    if (message.type === "offscreen/download-json") {
      void prepareJson(message.artifact)
        .then((url) => sendResponse({ ok: true, url }))
        .catch((error: unknown) =>
          sendResponse({ ok: false, error: String(error) }),
        );
      return true;
    }
    return false;
  },
);
async function start(streamId: string, sessionId: string) {
  if (recorder?.state === "recording")
    throw new Error("A recording is already active");
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
    },
  } as MediaStreamConstraints);
  chunks = [];
  activeSessionId = sessionId;
  recorder = new MediaRecorder(stream, { mimeType: supportedMimeType() });
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(1000);
}
async function stop(sessionId: string, uploadUrl: string) {
  if (!recorder || activeSessionId !== sessionId)
    throw new Error("没有找到正在进行的视频录制");
  const stopped = new Promise<void>((resolve) =>
    recorder!.addEventListener("stop", () => resolve(), { once: true }),
  );
  recorder.stop();
  await stopped;
  stream?.getTracks().forEach((track) => track.stop());
  const blob = new Blob(chunks, { type: recorder.mimeType });
  let uploadError: string | undefined;
  try {
    const body = new FormData();
    body.append("video", blob, `${sessionId}.webm`);
    const response = await fetch(uploadUrl, { method: "POST", body });
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  } catch (error) {
    uploadError = error instanceof Error ? error.message : String(error);
  }
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  recorder = undefined;
  stream = undefined;
  chunks = [];
  activeSessionId = undefined;
  return { url, uploadError };
}
function supportedMimeType() {
  return (
    ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    ) ?? "video/webm"
  );
}
async function prepareJson(artifact: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" }),
  );
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}
