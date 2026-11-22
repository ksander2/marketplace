import { createLogger } from "@marketplace/common";
import { RabbitMQBroker } from "@marketplace/messaging";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { CatalogService } from "./domain/catalog-service.js";
import { StockService } from "./domain/stock-service.js";
import { OrderEventHandler } from "./events/order-event-handler.js";
import { PrismaCatalogRepository } from "./infra/prisma-catalog-repository.js";
import { PrismaStockRepository } from "./infra/prisma-stock-repository.js";
import { createPrismaClient } from "./infra/prisma.js";

const logger = createLogger({ service: "catalog-service", level: config.LOG_LEVEL });
const prisma = createPrismaClient();
const broker = new RabbitMQBroker({ url: config.RABBITMQ_URL, logger });
const repository = new PrismaCatalogRepository(prisma);
const stock = new StockService(new PrismaStockRepository(prisma), broker);
const orderEvents = new OrderEventHandler(stock);

await Promise.all([prisma.$connect(), broker.connect()]);
await broker.consume({
  queue: "catalog-service.order",
  routingKeys: ["order.order.created"],
  handler: (event) => orderEvents.handle(event),
});

const catalog = new CatalogService(repository, broker);
const server = createApp({
  catalog,
  logger,
  isReady: async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },
}).listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "Catalog service is listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close((error) => {
    void Promise.allSettled([prisma.$disconnect(), broker.close()]).then(() => {
      if (error) {
        logger.error({ err: error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      }
    });
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
