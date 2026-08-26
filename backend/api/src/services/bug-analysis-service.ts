import { spawn } from "node:child_process";
import { readFile, readdir, rm, stat, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelProvider } from "@bug-agent/llm-gateway";
import type { BugReport } from "../domain/session.js";
import type { SessionStore } from "./session-store.js";

export class BugAnalysisService {
  constructor(
    private readonly sessions: SessionStore,
    private readonly provider: ModelProvider,
  ) { }

  async analyze(sessionId: string, description: string): Promise<BugReport> {
    const normalizedDescription = description.trim();
    if (!normalizedDescription || normalizedDescription.length > 5_000)
      throw new Error("INVALID_BUG_DESCRIPTION");
    const session = await this.sessions.get(sessionId);
    const images = await this.collectImages(sessionId);
    const generated = await this.provider.generateBugReport({
      description: normalizedDescription,
      title: session.title,
      pageUrl: session.pageUrl,
      events: session.events,
      executions:
        session.executions ??
        (session.lastExecution ? [session.lastExecution] : []),
      images,
    });
    const report: BugReport = {
      id: crypto.randomUUID(),
      description: normalizedDescription,
      generatedAt: new Date().toISOString(),
      provider: generated.provider,
      model: generated.model,
      ...generated.report,
    };
    await this.sessions.saveBugReport(sessionId, report);
    return report;
  }

  private async collectImages(sessionId: string) {
    const images: Array<{ mimeType: string; data: string }> = [];
    for (const kind of ["start-screenshot", "end-screenshot"] as const) {
      try {
        images.push({
          mimeType: "image/png",
          data: (
            await readFile(this.sessions.artifactFilePath(sessionId, kind))
          ).toString("base64"),
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    images.push(...(await this.extractVideoFrames(sessionId)));
    return images.slice(0, 8);
  }

  private async extractVideoFrames(
    sessionId: string,
  ): Promise<Array<{ mimeType: string; data: string }>> {
    try {
      await stat(this.sessions.videoPath(sessionId));
    } catch {
      return [];
    }
    const directory = await mkdtemp(join(tmpdir(), "bug-analysis-"));
    try {
      const outputPattern = join(directory, "frame-%02d.jpg");
      const code = await runProcess(process.env.FFMPEG_PATH ?? "ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        this.sessions.videoPath(sessionId),
        "-vf",
        "fps=1/5,scale=1280:-2:force_original_aspect_ratio=decrease",
        "-frames:v",
        "6",
        outputPattern,
      ]);
      if (code !== 0) return [];
      const files = (await readdir(directory))
        .filter((name) => name.endsWith(".jpg"))
        .sort();
      return await Promise.all(
        files.map(async (name) => ({
          mimeType: "image/jpeg",
          data: (await readFile(join(directory, name))).toString("base64"),
        })),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

function runProcess(command: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(1);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}
