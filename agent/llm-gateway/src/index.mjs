const bugReportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "summary",
    "severity",
    "confidence",
    "expectedBehavior",
    "actualBehavior",
    "stepsToReproduce",
    "probableCause",
    "recommendations",
    "evidence",
  ],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    expectedBehavior: { type: "string" },
    actualBehavior: { type: "string" },
    stepsToReproduce: { type: "array", items: { type: "string" } },
    probableCause: { type: "string" },
    recommendations: { type: "array", items: { type: "string" } },
    evidence: { type: "array", items: { type: "string" } },
  },
};

export class ModelProvider {
  async generateBugReport() {
    throw new Error("Model provider is not configured");
  }
}

export class OpenAIModelProvider extends ModelProvider {
  constructor({
    apiKey,
    model = "gpt-4o-mini",
    baseUrl = "https://api.openai.com/v1",
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async generateBugReport(input) {
    if (!this.apiKey) throw new Error("LLM_API_KEY_REQUIRED");
    const content = [{ type: "input_text", text: buildEvidencePrompt(input) }];
    for (const image of input.images ?? [])
      content.push({
        type: "input_image",
        image_url: `data:${image.mimeType};base64,${image.data}`,
        detail: "low",
      });
    const response = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions:
          "你是资深软件测试与缺陷分析工程师。仅依据用户描述和提供的复现证据生成中文 Bug 报告；无法确认的信息必须明确标注为推测，不得编造证据。",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "bug_report",
            strict: true,
            schema: bugReportSchema,
          },
        },
      }),
    });
    if (!response.ok)
      throw new Error(
        `LLM_REQUEST_FAILED:${response.status}:${await response.text()}`,
      );
    const payload = await response.json();
    const outputText =
      payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("LLM_EMPTY_RESPONSE");
    return {
      provider: "openai",
      model: this.model,
      report: JSON.parse(outputText),
    };
  }
}

export class MockModelProvider extends ModelProvider {
  async generateBugReport(input) {
    const actions = (input.events ?? []).filter(
      (event) => event.source === "action",
    );
    const failures = (input.events ?? []).filter(
      (event) => event.source === "exception" || event.source === "console",
    );
    return {
      provider: "mock",
      model: "deterministic-local",
      report: {
        title: input.description.slice(0, 80),
        summary: `根据问题描述及 ${input.images?.length ?? 0} 张视频关键帧、${input.events?.length ?? 0} 条录制事件生成的分析报告。`,
        severity: failures.length ? "high" : "medium",
        confidence: failures.length || actions.length ? 0.78 : 0.55,
        expectedBehavior: `系统应按用户描述正常完成操作：${input.description}`,
        actualBehavior: input.description,
        stepsToReproduce: actions.length
          ? actions
            .slice(0, 10)
            .map((event, index) => `${index + 1}. ${event.type}`)
          : [
            "1. 打开录制页面",
            "2. 按视频中的操作执行",
            `3. 观察问题：${input.description}`,
          ],
        probableCause: failures.length
          ? "录制中存在 Console 或异常事件，建议结合对应日志定位。"
          : "现有证据不足以确认根因，需要结合服务端日志和网络请求进一步定位。",
        recommendations: [
          "检查问题发生前后的 Console 与 Network 记录",
          "使用已生成的 Playwright 脚本稳定复现后定位首个异常点",
        ],
        evidence: [
          `页面：${input.pageUrl || "未知"}`,
          `录制事件：${input.events?.length ?? 0} 条`,
          `视频关键帧：${input.images?.length ?? 0} 张`,
        ],
      },
    };
  }
}

export function createModelProvider(env = process.env) {
  const provider = (env.LLM_PROVIDER ?? "mock").toLowerCase();
  if (provider === "mock") return new MockModelProvider();
  if (provider === "openai")
    return new OpenAIModelProvider({
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
      baseUrl: env.LLM_BASE_URL,
    });
  throw new Error(`UNSUPPORTED_LLM_PROVIDER:${provider}`);
}

function buildEvidencePrompt(input) {
  return [
    `用户问题描述：\n${input.description}`,
    `页面：${input.pageUrl || "未知"}`,
    `录制标题：${input.title || "未命名"}`,
    `录制事件（JSON）：\n${JSON.stringify((input.events ?? []).slice(0, 200))}`,
    `最近执行结果（JSON）：\n${JSON.stringify((input.executions ?? []).slice(-10))}`,
    `另附 ${input.images?.length ?? 0} 张按时间顺序排列的视频/录制关键帧。`,
  ].join("\n\n");
}
