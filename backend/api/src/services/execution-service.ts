import { spawn } from "node:child_process";
import { access, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ScriptExecution } from "../domain/session.js";
import type { SessionStore } from "./session-store.js";

const runnerPath = fileURLToPath(new URL("../../../worker/src/run-script.mjs", import.meta.url));

export class ExecutionService {
  constructor(private readonly sessions: SessionStore, private readonly timeoutMs = 30_000) {}

  async run(sessionId: string): Promise<ScriptExecution> {
    const session = await this.sessions.get(sessionId);
    if (!session.script) throw new Error("SCRIPT_NOT_FOUND");
    const running: ScriptExecution = { id: crypto.randomUUID(), status: "running", startedAt: new Date().toISOString() };
    await this.sessions.saveExecution(sessionId, running);
    const started = Date.now();
    const screenshotPath = `${this.sessions.executionDirectory(sessionId)}/execution-final.png`;
    await rm(screenshotPath, { force: true });
    const outcome = await this.spawn(sessionId);
    const hasScreenshot = await access(screenshotPath).then(() => true).catch(() => false);
    const archivedScreenshotPath = `${this.sessions.executionDirectory(sessionId)}/execution-${running.id}.png`;
    if (hasScreenshot) await rename(screenshotPath, archivedScreenshotPath);
    const execution: ScriptExecution = {
      ...running,
      status: outcome.timedOut ? "timed_out" : outcome.code === 0 ? "passed" : "failed",
      finishedAt: new Date().toISOString(), durationMs: Date.now() - started,
      output: outcome.stdout.trim() || undefined, error: outcome.stderr.trim() || undefined,
      screenshotUrl: hasScreenshot ? `/api/v1/sessions/${sessionId}/executions/${running.id}/screenshot` : undefined,
    };
    await this.sessions.saveExecution(sessionId, execution);
    return execution;
  }

  private spawn(sessionId: string): Promise<{ code: number; stdout: string; stderr: string; timedOut: boolean }> {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [runnerPath, this.sessions.scriptPath(sessionId)], {
        cwd: this.sessions.executionDirectory(sessionId), stdio: ["ignore", "pipe", "pipe"],
        env: { PATH: process.env.PATH, CHROME_PATH: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
      });
      let stdout = "", stderr = "", timedOut = false;
      child.stdout.on("data", (chunk) => { stdout += String(chunk).slice(0, 20_000); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 20_000); });
      const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, this.timeoutMs);
      child.on("error", (error) => { clearTimeout(timer); resolve({ code: 1, stdout, stderr: error.message, timedOut }); });
      child.on("exit", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stdout, stderr, timedOut }); });
    });
  }
}
