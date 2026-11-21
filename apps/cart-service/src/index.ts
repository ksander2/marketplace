import { createLogger } from "@marketplace/common";
import { RabbitMQBroker } from "@marketplace/messaging";
import { createClient } from "redis";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { CartService } from "./domain/cart-service.js";
import { CatalogEventHandler } from "./events/catalog-event-handler.js";
import { RedisCartRepository } from "./infra/redis-cart-repository.js";

const logger = createLogger({ service: "cart-service", level: config.LOG_LEVEL });
const redis = createClient({ url: config.REDIS_URL });
redis.on("error", (error) => logger.error({ err: error }, "Redis client error"));
const broker = new RabbitMQBroker({ url: config.RABBITMQ_URL, logger });
const repository = new RedisCartRepository(redis);
const events = new CatalogEventHandler(repository);

await Promise.all([
  redis.connect(),
  broker.consume({
    queue: "cart-service.catalog",
    routingKeys: ["catalog.product.*"],
    handler: (event) => events.handle(event),
  }),
]);

const server = createApp({
  cart: new CartService(repository),
  logger,
  isReady: () => redis.isReady,
}).listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "Cart service is listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close((error) => {
    void Promise.allSettled([redis.quit(), broker.close()]).then(() => {
      if (error) {
        logger.error({ err: error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      }
    });
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
