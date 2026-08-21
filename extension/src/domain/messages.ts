import type { RecordingState, RecordingStatus } from "./recording";
export type ExtensionMessage =
  | { type: "recording/status:get" }
  | {
    type: "recording/status";
    status: RecordingStatus;
    session?: RecordingState;
    error?: string;
  }
  | { type: "recording/start"; tabId: number }
  | { type: "recording/stop" }
  | {
    type: "content/action";
    action: {
      timestamp: number;
      type: string;
      url: string;
      target: Record<string, unknown>;
      value?: string;
    };
  }
  | { type: "offscreen/start"; streamId: string; sessionId: string }
  | { type: "offscreen/stop"; sessionId: string; uploadUrl: string }
  | { type: "offscreen/download-json"; sessionId: string; artifact: unknown };
