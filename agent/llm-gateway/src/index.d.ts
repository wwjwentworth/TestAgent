export interface BugReportContent {
    title: string;
    summary: string;
    severity: "critical" | "high" | "medium" | "low";
    confidence: number;
    expectedBehavior: string;
    actualBehavior: string;
    stepsToReproduce: string[];
    probableCause: string;
    recommendations: string[];
    evidence: string[];
}
export interface BugAnalysisInput {
    description: string;
    title?: string;
    pageUrl?: string;
    events?: Array<{
        timestamp: number;
        source: string;
        type: string;
        data: Record<string, unknown>;
    }>;
    executions?: unknown[];
    images?: Array<{ mimeType: string; data: string }>;
}
export interface GeneratedBugReport {
    provider: string;
    model: string;
    report: BugReportContent;
}
export class ModelProvider {
    generateBugReport(input: BugAnalysisInput): Promise<GeneratedBugReport>;
}
export class MockModelProvider extends ModelProvider { }
export class OpenAIModelProvider extends ModelProvider {
    constructor(options: { apiKey?: string; model?: string; baseUrl?: string });
}
export function createModelProvider(env?: NodeJS.ProcessEnv): ModelProvider;
