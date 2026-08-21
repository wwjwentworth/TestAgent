export interface TabVideoCapture {
    start(tabId: number): Promise<MediaStream>;
    stop(): Promise<void>;
}
export interface PageEvidenceCapture {
    attach(tabId: number): Promise<void>;
    detach(tabId: number): Promise<void>;
}
export interface EvidenceUploader {
    uploadChunk(sessionId: string, chunk: Blob): Promise<void>;
}
// Future implementations will use tabCapture, debugger/CDP, IndexedDB and HTTP.
