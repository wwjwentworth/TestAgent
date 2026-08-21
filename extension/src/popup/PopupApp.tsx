import { useEffect, useState } from "react";
import type { ExtensionMessage } from "../domain/messages";
import type { RecordingState, RecordingStatus } from "../domain/recording";

const evidenceTypes = ["页面截图", "控制台日志", "网络请求", "标签页视频"];
type StatusResponse = {
  type: "recording/status";
  status: RecordingStatus;
  session?: RecordingState;
  error?: string;
};

export function PopupApp() {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [session, setSession] = useState<RecordingState>();
  const [pageTitle, setPageTitle] = useState("正在读取当前页面…");
  const [error, setError] = useState<string>();
  useEffect(() => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => setPageTitle(tab?.title ?? "当前页面不可用"));
    void send({ type: "recording/status:get" })
      .then(applyResponse)
      .catch(showError);
  }, []);
  const busy = status === "starting" || status === "stopping";
  const recording = status === "recording";
  async function toggleRecording() {
    setError(undefined);
    try {
      if (recording) {
        setStatus("stopping");
        applyResponse(await send({ type: "recording/stop" }));
        return;
      }
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id || !tab.url?.startsWith("http"))
        throw new Error("请在普通 HTTP/HTTPS 页面上开始录制");
      setStatus("starting");
      applyResponse(await send({ type: "recording/start", tabId: tab.id }));
    } catch (caught) {
      showError(caught);
    }
  }
  function applyResponse(response: StatusResponse) {
    setStatus(response.status);
    setSession(response.session);
    setError(response.error);
  }
  function showError(caught: unknown) {
    setStatus("error");
    setError(caught instanceof Error ? caught.message : String(caught));
  }
  return (
    <div className={`popup ${recording ? "is-recording" : ""}`}>
      <header className="brand">
        <span className="logo">BA</span>
        <div>
          <strong>Bug Agent</strong>
          <small>现场采集插件</small>
        </div>
        <span className={`status status-${status}`}>{statusText(status)}</span>
      </header>
      <main>
        <section className="current-page">
          <span className="icon">◎</span>
          <div>
            <small>当前页面</small>
            <p title={session?.tabTitle ?? pageTitle}>
              {session?.tabTitle ?? pageTitle}
            </p>
          </div>
        </section>
        <section className="permissions">
          <h2>本次采集</h2>
          <div className="chips">
            {evidenceTypes.map((type) => (
              <span key={type}>{type}</span>
            ))}
          </div>
        </section>
        <button
          className="record"
          onClick={() => void toggleRecording()}
          disabled={busy}
        >
          <span>●</span> {buttonText(status)}
        </button>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <p className="notice">
            停止后将上传 WebM 视频，并在本地保留视频和脱敏 JSON 证据包。
          </p>
        )}
      </main>
      <footer>
        <button onClick={() => chrome.runtime.openOptionsPage()}>
          插件设置
        </button>
        <span>v0.1.0</span>
      </footer>
    </div>
  );
}

async function send(message: ExtensionMessage): Promise<StatusResponse> {
  const response: unknown = await chrome.runtime.sendMessage(message);
  if (!isStatusResponse(response))
    throw new Error(
      "录制后台未返回有效状态，请在 chrome://extensions 中重新加载插件",
    );
  return response;
}

function isStatusResponse(value: unknown): value is StatusResponse {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as Partial<StatusResponse>).type === "recording/status" &&
    typeof (value as Partial<StatusResponse>).status === "string",
  );
}
function statusText(status: RecordingStatus) {
  return {
    idle: "未录制",
    starting: "启动中",
    recording: "录制中",
    stopping: "处理中",
    error: "异常",
  }[status];
}
function buttonText(status: RecordingStatus) {
  if (status === "recording") return "停止并保存";
  if (status === "starting") return "正在启动…";
  if (status === "stopping") return "正在保存…";
  return "开始录制";
}
