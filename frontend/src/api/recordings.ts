export interface Recording {
  id: string;
  title?: string;
  pageUrl?: string;
  mimeType: "video/webm";
  size: number;
  createdAt: string;
  videoUrl: string;
}

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

export async function listRecordings(signal?: AbortSignal): Promise<Recording[]> {
  const response = await fetch(`${apiBaseUrl}/api/v1/recordings`, { signal });
  if (!response.ok) throw new Error(`加载录制列表失败：HTTP ${response.status}`);
  const payload = await response.json() as { items: Recording[] };
  return payload.items;
}

export function recordingVideoUrl(recording: Recording): string {
  return `${apiBaseUrl}${recording.videoUrl}`;
}
