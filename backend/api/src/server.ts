import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadConfig, loadEnvFileIfPresent } from "./config.js";

loadEnvFileIfPresent(fileURLToPath(new URL("../../../.env", import.meta.url)));

const config = loadConfig();
const app = await createApp();
app.log.info({
    llmProvider: process.env.LLM_PROVIDER ?? "mock",
    llmModel: process.env.LLM_MODEL,
    llmApiKeyConfigured: Boolean(process.env.LLM_API_KEY),
}, "LLM configuration loaded");

async function shutdown(signal: string) {
    app.log.info({ signal }, "Shutting down API");
    await app.close();
    process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
    await app.listen({ port: config.port, host: config.host });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}
