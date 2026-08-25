import { useEffect, useState } from "react";
import { Button, Modal } from "antd";
import {
  absoluteApiUrl,
  deleteScript,
  deleteSession,
  getSession,
  listRecordings,
  recordingVideoUrl,
  regenerateScript,
  runScript,
  saveScript,
  type Recording,
  type SessionDetail,
} from "../api/recordings";

export function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [session, setSession] = useState<SessionDetail>();
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<
    "save" | "regenerate" | "run" | "delete" | "delete-task"
  >();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    void listRecordings(controller.signal)
      .then((items) => {
        setRecordings(items);
        setSelectedId((current) => current ?? items[0]?.id);
      })
      .catch(showError)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setError(undefined);
    setMessage(undefined);
    setSession(undefined);
    void getSession(selectedId, controller.signal)
      .then(syncSession)
      .catch(showError);
    return () => controller.abort();
  }, [selectedId]);

  function showError(caught: unknown) {
    if ((caught as Error).name !== "AbortError")
      setError(caught instanceof Error ? caught.message : String(caught));
  }
  function syncSession(value: SessionDetail) {
    setSession(value);
    setSource(value.script?.source ?? "");
  }
  async function onSave() {
    if (!session) return;
    setBusy("save");
    setError(undefined);
    try {
      syncSession(await saveScript(session.id, source));
      setMessage("脚本已保存");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(undefined);
    }
  }
  async function onRegenerate() {
    if (!session) return;
    setBusy("regenerate");
    setError(undefined);
    try {
      syncSession(await regenerateScript(session.id));
      setMessage("已根据原始录制重新生成 Playwright 脚本");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(undefined);
    }
  }
  async function onRun() {
    if (!session) return;
    setBusy("run");
    setError(undefined);
    try {
      await saveScript(session.id, source);
      const execution = await runScript(session.id);
      syncSession(await getSession(session.id));
      setMessage(
        execution.status === "passed"
          ? `运行通过（${execution.durationMs ?? 0} ms）`
          : `运行${execution.status}`,
      );
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(undefined);
    }
  }
  function confirmDeleteScript() {
    if (!session?.script) return;
    Modal.confirm({
      title: "删除复现脚本？",
      content: "原始录制和事件会保留，之后仍可重新生成脚本。",
      okText: "删除脚本",
      cancelText: "取消",
      okType: "danger",
      centered: true,
      onOk: onDelete,
    });
  }
  async function onDelete() {
    if (!session?.script) return;
    setBusy("delete");
    setError(undefined);
    try {
      syncSession(await deleteScript(session.id));
      setMessage("脚本已删除，可通过录制事件重新生成");
    } catch (caught) {
      showError(caught);
      throw caught;
    } finally {
      setBusy(undefined);
    }
  }
  function confirmDeleteTask() {
    if (!session) return;
    Modal.confirm({
      title: `永久删除“${session.title || session.id}”？`,
      content: "视频、事件、截图、脚本和运行结果都会被删除，且无法恢复。",
      okText: "确认永久删除",
      cancelText: "取消",
      okType: "danger",
      centered: true,
      onOk: onDeleteTask,
    });
  }
  async function onDeleteTask() {
    if (!session) return;
    setBusy("delete-task");
    setError(undefined);
    try {
      await deleteSession(session.id);
      const remaining = recordings.filter((item) => item.id !== session.id);
      setRecordings(remaining);
      setSession(undefined);
      setSource("");
      setSelectedId(remaining[0]?.id);
      setMessage(remaining.length ? "原始任务已删除" : undefined);
    } catch (caught) {
      showError(caught);
      throw caught;
    } finally {
      setBusy(undefined);
    }
  }

  if (loading)
    return (
      <section className="card recordings-state">正在加载录制结果…</section>
    );
  if (!recordings.length)
    return (
      <section className="card recordings-state">
        <strong>还没有上传的录制结果</strong>
        <span>通过插件完成一次录制后，脚本会同步生成。</span>
      </section>
    );
  const selected =
    recordings.find((item) => item.id === selectedId) ?? recordings[0];
  return (
    <section className="recordings-layout">
      <aside className="card recordings-list">
        <h2>复现任务</h2>
        {recordings.map((item) => (
          <button
            key={item.id}
            className={item.id === selected.id ? "selected" : ""}
            onClick={() => setSelectedId(item.id)}
          >
            <strong>{item.title || "未命名录制"}</strong>
            <span>
              {formatDate(item.createdAt)} · {formatBytes(item.size)}
            </span>
          </button>
        ))}
      </aside>
      <div className="recording-content">
        {session && (
          <div className="task-actions">
            <div>
              <span>任务 ID：{session.id}</span>
            </div>
            <Button
              danger
              onClick={confirmDeleteTask}
              loading={busy === "delete-task"}
              disabled={Boolean(busy)}
            >
              删除原始任务
            </Button>
          </div>
        )}
        <article className="card recording-player">
            <div className="recording-heading">
              <div>
                <h2>{selected.title || "未命名录制"}</h2>
                <p>{selected.pageUrl || selected.id}</p>
              </div>
              <span>{formatBytes(selected.size)}</span>
            </div>
            <video
              key={selected.id}
              controls
              preload="metadata"
              src={recordingVideoUrl(selected)}
            >
              当前浏览器不支持 WebM 视频播放。
            </video>
        </article>
        {error && <div className="editor-message error">{error}</div>}
        {message && <div className="editor-message success">{message}</div>}
        {session && (
          <>
            <article className="card code-panel">
              <div className="panel-heading">
                <div>
                  <h2>Playwright 复现脚本</h2>
                  <p>
                    {session.script
                      ? `已根据 ${session.eventCount} 条录制事件生成，可编辑并运行`
                      : "脚本已删除，可从原始录制重新生成"}
                  </p>
                </div>
                <div className="editor-actions">
                  {session.script && (
                    <Button
                      danger
                      onClick={confirmDeleteScript}
                      loading={busy === "delete"}
                      disabled={Boolean(busy)}
                    >
                      删除脚本
                    </Button>
                  )}
                  <Button
                    onClick={onRegenerate}
                    loading={busy === "regenerate"}
                    disabled={Boolean(busy)}
                  >
                    从录制重新生成
                  </Button>
                  <button
                    onClick={onSave}
                    disabled={Boolean(busy) || !source.trim()}
                  >
                    {busy === "save" ? "保存中…" : "保存脚本"}
                  </button>
                  <button
                    className="primary"
                    onClick={onRun}
                    disabled={Boolean(busy) || !source.trim()}
                  >
                    {busy === "run" ? "运行中…" : "保存并运行"}
                  </button>
                </div>
              </div>
              <textarea
                className="code-editor"
                spellCheck={false}
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="脚本已删除，请点击“从录制重新生成”。"
                aria-label="Playwright 脚本"
              />
            </article>
            {session.lastExecution && (
              <article className="card execution-result">
                <div className="panel-heading">
                  <div>
                    <h2>最近运行结果</h2>
                    <p>{session.lastExecution.durationMs ?? 0} ms</p>
                  </div>
                  <span
                    className={`execution-status ${session.lastExecution.status}`}
                  >
                    {session.lastExecution.status}
                  </span>
                </div>
                {session.lastExecution.error && (
                  <pre>{session.lastExecution.error}</pre>
                )}
                {session.lastExecution.output && (
                  <pre>{session.lastExecution.output}</pre>
                )}
                {session.lastExecution.screenshotUrl && (
                  <img
                    src={absoluteApiUrl(session.lastExecution.screenshotUrl)}
                    alt="脚本运行结束页面截图"
                  />
                )}
              </article>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${(value / 1024).toFixed(1)} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
