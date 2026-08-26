import { useEffect, useState } from "react";
import { Button, Modal } from "antd";
import {
  absoluteApiUrl,
  analyzeBug,
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
import { formatDate } from "../utils/formatDate";
import { formatBytes } from "../utils/formatBytes";

export function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [session, setSession] = useState<SessionDetail>();
  const [source, setSource] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<
    "save" | "regenerate" | "run" | "analyze" | "delete" | "delete-task"
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
    setBugDescription(value.bugReport?.description ?? "");
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
  async function onAnalyzeBug() {
    if (!session || !bugDescription.trim()) return;
    setBusy("analyze");
    setError(undefined);
    setMessage(undefined);
    try {
      const bugReport = await analyzeBug(session.id, bugDescription);
      setSession((current) =>
        current?.id === session.id ? { ...current, bugReport } : current,
      );
      setBugDescription(bugReport.description);
      setMessage("Bug 分析完成，报告已生成");
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
            <article className="card bug-analysis-panel">
              <div className="panel-heading">
                <div>
                  <h2>LLM 分析 Bug</h2>
                  <p>输入问题描述，结合复现视频、关键帧和录制事件生成报告</p>
                </div>
              </div>
              <textarea
                value={bugDescription}
                onChange={(event) => setBugDescription(event.target.value)}
                placeholder="例如：点击提交订单后页面一直加载，没有跳转到支付页。"
                maxLength={5000}
                aria-label="Bug 问题描述"
              />
              <div className="bug-analysis-actions">
                <span>{bugDescription.length}/5000</span>
                <Button
                  type="primary"
                  onClick={onAnalyzeBug}
                  loading={busy === "analyze"}
                  disabled={Boolean(busy) || !bugDescription.trim()}
                >
                  {session.bugReport
                    ? "重新分析并生成报告"
                    : "分析并生成 Bug 报告"}
                </Button>
              </div>
            </article>
            {session.bugReport && (
              <article className="card bug-report" key={session.bugReport.id}>
                <div className="panel-heading">
                  <div>
                    <h2>{session.bugReport.title}</h2>
                    <p>
                      {formatDate(session.bugReport.generatedAt)} ·{" "}
                      {session.bugReport.provider}/{session.bugReport.model} ·
                      置信度 {Math.round(session.bugReport.confidence * 100)}%
                    </p>
                  </div>
                  <span
                    className={`bug-severity ${session.bugReport.severity}`}
                  >
                    {session.bugReport.severity}
                  </span>
                </div>
                <ReportSection
                  title="问题摘要"
                  content={session.bugReport.summary}
                />
                <div className="bug-report-columns">
                  <ReportSection
                    title="预期行为"
                    content={session.bugReport.expectedBehavior}
                  />
                  <ReportSection
                    title="实际行为"
                    content={session.bugReport.actualBehavior}
                  />
                </div>
                <ReportSection
                  title="可能原因"
                  content={session.bugReport.probableCause}
                />
                <div className="bug-report-columns">
                  <ReportList
                    title="修复建议"
                    items={session.bugReport.recommendations}
                  />
                  <ReportList
                    title="分析证据"
                    items={session.bugReport.evidence}
                  />
                </div>
              </article>
            )}
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
            {(session.executions?.length || session.lastExecution) && (
              <article className="card execution-result">
                <div className="panel-heading">
                  <div>
                    <h2>运行日志</h2>
                    <p>共 {session.executions?.length ?? 1} 次运行</p>
                  </div>
                </div>
                <div className="execution-list">
                  {[...(session.executions ?? [session.lastExecution!])]
                    .reverse()
                    .map((execution) => (
                      <section className="execution-entry" key={execution.id}>
                        <div className="execution-entry-heading">
                          <div>
                            <strong>
                              {new Date(execution.startedAt).toLocaleString(
                                "zh-CN",
                              )}
                            </strong>
                            <span>{execution.durationMs ?? 0} ms</span>
                          </div>
                          <span
                            className={`execution-status ${execution.status}`}
                          >
                            {execution.status}
                          </span>
                        </div>
                        {execution.error && <pre>{execution.error}</pre>}
                        {execution.output && <pre>{execution.output}</pre>}
                        {!execution.error && !execution.output && (
                          <p className="execution-empty">
                            本次运行没有输出日志
                          </p>
                        )}
                        {execution.screenshotUrl && (
                          <img
                            src={absoluteApiUrl(execution.screenshotUrl)}
                            alt={`${new Date(execution.startedAt).toLocaleString("zh-CN")} 运行结束页面截图`}
                          />
                        )}
                      </section>
                    ))}
                </div>
              </article>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ReportSection({ title, content }: { title: string; content: string }) {
  return (
    <section className="report-section">
      <h3>{title}</h3>
      <p>{content}</p>
    </section>
  );
}

function ReportList({
  title,
  items,
  ordered = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  const children = items.map((item, index) => (
    <li key={`${index}-${item}`}>{item.replace(/^\d+\.\s*/, "")}</li>
  ));
  return (
    <section className="report-section">
      <h3>{title}</h3>
      {ordered ? <ol>{children}</ol> : <ul>{children}</ul>}
    </section>
  );
}
