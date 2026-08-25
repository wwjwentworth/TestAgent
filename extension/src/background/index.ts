import type { ExtensionMessage } from "../domain/messages";
import type { EvidenceEvent, RecordingState } from "../domain/recording";
import { toEvidenceEvent } from "./evidence";
import { loadSettings } from "../infrastructure/settings-store.js";
import { dataUrlToBlob, SessionApi } from "../infrastructure/session-api.js";

const target = (tabId: number): chrome.debugger.Debuggee => ({ tabId });
let session: RecordingState | undefined;
let events: EvidenceEvent[] = [];
let startScreenshot: string | undefined;

chrome.runtime.onInstalled.addListener(() =>
    console.info("Bug Reproduction Agent installed"),
);
chrome.debugger.onEvent.addListener((source, method, params) => {
    if (!session || source.tabId !== session.tabId) return;
    const event = toEvidenceEvent(
        method,
        (params ?? {}) as Record<string, unknown>,
    );
    if (event) appendEvent(event);
});
chrome.debugger.onDetach.addListener((source) => {
    if (
        session &&
        source.tabId === session.tabId &&
        session.status === "recording"
    )
        void stopRecording("Debugger detached");
});
chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, sendResponse) => {
        if (message.type === "recording/status:get") {
            sendResponse({
                type: "recording/status",
                status: session?.status ?? "idle",
                session,
            });
            return false;
        }
        if (message.type === "content/action") {
            if (session && _sender.tab?.id === session.tabId)
                appendEvent({
                        timestamp: message.action.timestamp,
                        source: "action",
                        type: message.action.type,
                        data: { url: message.action.url, target: message.action.target, value: message.action.value },
                    });
            return false;
        }
        if (message.type === "recording/start") {
            void startRecording(message.tabId)
                .then(sendResponse)
                .catch((error: unknown) => sendResponse(failure(error)));
            return true;
        }
        if (message.type === "recording/stop") {
            void stopRecording()
                .then(sendResponse)
                .catch((error: unknown) => sendResponse(failure(error)));
            return true;
        }
        return false;
    },
);

async function startRecording(tabId: number) {
    if (session?.status === "recording")
        return { type: "recording/status", status: "recording", session };
    const tab = await chrome.tabs.get(tabId);
    session = {
        id: crypto.randomUUID(),
        tabId,
        startedAt: Date.now(),
        status: "starting",
        tabTitle: tab.title,
        tabUrl: tab.url,
    };
    events = [];
    try {
        const settings = await loadSettings();
        await new SessionApi(settings.apiBaseUrl).create({
            id: session.id,
            startedAt: session.startedAt,
            title: session.tabTitle,
            pageUrl: session.tabUrl,
            projectId: settings.projectId,
        });
        await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content.js"] });
        await ensureOffscreenDocument();
        await chrome.debugger.attach(target(tabId), "1.3");
        await Promise.all([
            chrome.debugger.sendCommand(target(tabId), "Network.enable"),
            chrome.debugger.sendCommand(target(tabId), "Runtime.enable"),
        ]);
        startScreenshot = await captureTab(tab.windowId);
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
        const result = await chrome.runtime.sendMessage({ type: "offscreen/start", streamId, sessionId: session.id } satisfies ExtensionMessage);
        if (!result?.ok) throw new Error(result?.error ?? "视频录制页面没有响应");
        session = { ...session, status: "recording" };
        await chrome.action.setBadgeText({ tabId, text: "REC" });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: "#d93025" });
        return { type: "recording/status" as const, status: "recording" as const, session };
    } catch (error) {
        await chrome.debugger.detach(target(tabId)).catch(() => undefined);
        await chrome.action.setBadgeText({ tabId, text: "" }).catch(() => undefined);
        session = undefined;
        throw error;
    }
}

async function stopRecording(reason?: string) {
    if (!session) return { type: "recording/status", status: "idle" };
    const current = { ...session, status: "stopping" as const };
    session = current;
    const endScreenshot = await chrome.tabs
        .get(current.tabId)
        .then((tab) => captureTab(tab.windowId))
        .catch(() => undefined);
    const settings = await loadSettings();
    const sessionApi = new SessionApi(settings.apiBaseUrl);
    const uploadUrl = new URL(`/api/v1/recordings/${current.id}/video`, settings.apiBaseUrl);
    if (current.tabTitle) uploadUrl.searchParams.set("title", current.tabTitle);
    if (current.tabUrl) uploadUrl.searchParams.set("pageUrl", current.tabUrl);
    const videoResult = await chrome.runtime.sendMessage({
        type: "offscreen/stop",
        sessionId: current.id,
        uploadUrl: uploadUrl.toString(),
    } satisfies ExtensionMessage);
    if (!videoResult?.ok || !videoResult.url)
        throw new Error(videoResult?.error ?? "视频文件生成失败");
    await chrome.downloads.download({
        url: videoResult.url,
        filename: `bug-agent-${current.id}-video.webm`,
        saveAs: false,
    });
    await chrome.debugger.detach(target(current.tabId)).catch(() => undefined);
    await chrome.action.setBadgeText({ tabId: current.tabId, text: "" });
    const artifact = {
        version: 1,
        session: { ...current, status: "idle", endedAt: Date.now(), reason },
        screenshots: { start: startScreenshot, end: endScreenshot },
        events,
    };
    await sessionApi.uploadEvents(current.id, events);
    if (startScreenshot) await sessionApi.uploadArtifact(current.id, "start-screenshot", await dataUrlToBlob(startScreenshot), "start.png");
    if (endScreenshot) await sessionApi.uploadArtifact(current.id, "end-screenshot", await dataUrlToBlob(endScreenshot), "end.png");
    await sessionApi.uploadArtifact(current.id, "evidence", new Blob([JSON.stringify(artifact)], { type: "application/json" }), "evidence.json");
    await sessionApi.complete(current.id, { endedAt: artifact.session.endedAt, reason });
    const evidenceResult = await chrome.runtime.sendMessage({
        type: "offscreen/download-json",
        sessionId: current.id,
        artifact,
    } satisfies ExtensionMessage);
    if (!evidenceResult?.ok || !evidenceResult.url)
        throw new Error(evidenceResult?.error ?? "证据文件生成失败");
    await chrome.downloads.download({
        url: evidenceResult.url,
        filename: `bug-agent-${current.id}-evidence.json`,
        saveAs: false,
    });
    session = undefined;
    events = [];
    startScreenshot = undefined;
    if (videoResult.uploadError)
        throw new Error(`视频已保存到本地，但上传失败：${videoResult.uploadError}`);
    return { type: "recording/status" as const, status: "idle" as const };
}

async function ensureOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL("offscreen.html");
    const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [offscreenUrl],
    });
    if (contexts.length > 0) return;
    await chrome.offscreen.createDocument({
        url: offscreenUrl,
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification:
            "Record the active tab after the user starts a Bug recording.",
    });
}
async function captureTab(windowId?: number): Promise<string> {
    const options = { format: "png" as const, quality: 90 };
    return windowId === undefined
        ? chrome.tabs.captureVisibleTab(options)
        : chrome.tabs.captureVisibleTab(windowId, options);
}
function failure(error: unknown) {
    console.error(error);
    return {
        type: "recording/status" as const,
        status: "error" as const,
        error: error instanceof Error ? error.message : String(error),
    };
}
function appendEvent(event: EvidenceEvent) {
    const limit = 5000;
    if (events.length < limit) { events.push(event); return; }
    if (event.source !== "action") return;
    const replaceIndex = events.findIndex((existing) => existing.source !== "action");
    if (replaceIndex >= 0) events.splice(replaceIndex, 1);
    events.push(event);
}
