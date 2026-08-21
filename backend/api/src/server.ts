import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await createApp();

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
