import { useEffect, useState } from "react";
import { listRecordings, recordingVideoUrl, type Recording } from "../api/recordings";

export function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    void listRecordings(controller.signal).then((items) => { setRecordings(items); setSelectedId((current) => current ?? items[0]?.id); }).catch((caught) => { if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : String(caught)); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (loading) return <section className="card recordings-state">正在加载录制视频…</section>;
  if (error) return <section className="card recordings-state recordings-error"><strong>无法连接录制服务</strong><span>{error}</span></section>;
  if (!recordings.length) return <section className="card recordings-state"><strong>还没有上传的视频</strong><span>通过插件完成一次录制后，视频会出现在这里。</span></section>;

  const selected = recordings.find((recording) => recording.id === selectedId) ?? recordings[0];
  return <section className="recordings-layout"><aside className="card recordings-list"><h2>录制视频</h2>{recordings.map((recording) => <button key={recording.id} className={recording.id === selected.id ? "selected" : ""} onClick={() => setSelectedId(recording.id)}><strong>{recording.title || "未命名录制"}</strong><span>{formatDate(recording.createdAt)} · {formatBytes(recording.size)}</span></button>)}</aside><article className="card recording-player"><div className="recording-heading"><div><h2>{selected.title || "未命名录制"}</h2><p>{selected.pageUrl || selected.id}</p></div><span>{formatBytes(selected.size)}</span></div><video key={selected.id} controls preload="metadata" src={recordingVideoUrl(selected)}>当前浏览器不支持 WebM 视频播放。</video></article></section>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatBytes(value: number) { if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB`; }
