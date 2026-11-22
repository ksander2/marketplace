import { createLogger } from "@marketplace/common";
import { RabbitMQBroker } from "@marketplace/messaging";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { OrderService } from "./domain/order-service.js";
import { CatalogEventHandler } from "./events/catalog-event-handler.js";
import { StockEventHandler } from "./events/stock-event-handler.js";
import { PrismaOrderRepository } from "./infra/prisma-order-repository.js";
import { createPrismaClient } from "./infra/prisma.js";

const logger = createLogger({ service: "order-service", level: config.LOG_LEVEL });
const prisma = createPrismaClient();
const broker = new RabbitMQBroker({ url: config.RABBITMQ_URL, logger });
const repository = new PrismaOrderRepository(prisma);
const orders = new OrderService(repository, broker);
const catalogEvents = new CatalogEventHandler(repository);
const stockEvents = new StockEventHandler(orders);

await Promise.all([prisma.$connect(), broker.connect()]);
await Promise.all([
  broker.consume({
    queue: "order-service.catalog",
    routingKeys: ["catalog.product.*"],
    handler: (event) => catalogEvents.handle(event),
  }),
  broker.consume({
    queue: "order-service.stock",
    routingKeys: ["catalog.stock.reserved", "catalog.stock.rejected"],
    handler: (event) => stockEvents.handle(event),
  }),
]);

const server = createApp({
  orders,
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
  logger.info({ port: config.PORT }, "Order service is listening");
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
