import { createLogger } from "@marketplace/common";
import { createApp } from "./app.js";
import { config } from "./config/index.js";

const logger = createLogger({ service: "api-gateway", level: config.LOG_LEVEL });
const server = createApp().listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "API Gateway is listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "HTTP server shutdown failed");
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
