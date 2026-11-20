import { createLogger } from "@marketplace/common";
import { importJWK } from "jose";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { createClient } from "redis";
import { createApp } from "./app.js";
import { config } from "./config/index.js";

const logger = createLogger({ service: "api-gateway", level: config.LOG_LEVEL });
const redis = createClient({ url: config.REDIS_URL });
redis.on("error", (error) => logger.error({ err: error }, "Redis client error"));
await redis.connect();

const publicKey = await importJWK(JSON.parse(config.JWT_PUBLIC_JWK), "EdDSA");
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  useRedisPackage: true,
  keyPrefix: "gateway:rate-limit",
  points: config.RATE_LIMIT_POINTS,
  duration: config.RATE_LIMIT_DURATION_SECONDS,
});
const server = createApp({
  authServiceUrl: config.AUTH_SERVICE_URL,
  catalogServiceUrl: config.CATALOG_SERVICE_URL,
  corsOrigins: config.CORS_ORIGINS,
  publicKey,
  rateLimiter,
  isReady: () => redis.isReady,
  logger,
}).listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "API Gateway is listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close((error) => {
    void redis.quit().then(() => {
      if (error) {
        logger.error({ err: error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      }
    });
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
