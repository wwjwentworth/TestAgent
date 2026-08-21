export type RecordingStatus =
    | "idle"
    | "starting"
    | "recording"
    | "stopping"
    | "error";
export interface RecordingSession {
    id: string;
    tabId: number;
    startedAt: number;
    status: RecordingStatus;
}
export interface RecordingState extends RecordingSession {
    tabTitle?: string;
    tabUrl?: string;
}
export type { RecordedEvent as EvidenceEvent } from "@bug-agent/event-schema";
export interface ExtensionSettings {
    apiBaseUrl: string;
    projectId?: string;
}
export const defaultSettings: ExtensionSettings = {
    apiBaseUrl: "http://localhost:3001",
};
