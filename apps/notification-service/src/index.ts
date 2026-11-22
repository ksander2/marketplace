import { createLogger } from "@marketplace/common";
import { RabbitMQBroker } from "@marketplace/messaging";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { NotificationService } from "./domain/notification-service.js";
import { NotificationEventHandler } from "./events/notification-event-handler.js";
import { PrismaNotificationRepository } from "./infra/prisma-notification-repository.js";
import { createPrismaClient } from "./infra/prisma.js";
import { SmtpMailer } from "./infra/smtp-mailer.js";

const logger = createLogger({ service: "notification-service", level: config.LOG_LEVEL });
const prisma = createPrismaClient();
const broker = new RabbitMQBroker({ url: config.RABBITMQ_URL, logger });
const repository = new PrismaNotificationRepository(prisma);
const mailer = new SmtpMailer({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  from: config.SMTP_FROM,
});
const notifications = new NotificationService(repository, mailer, logger);
const events = new NotificationEventHandler(notifications);

await Promise.all([prisma.$connect(), broker.connect()]);
await Promise.all([
  broker.consume({
    queue: "notification-service.auth",
    routingKeys: ["auth.user.registered"],
    handler: (event) => events.handle(event),
  }),
  broker.consume({
    queue: "notification-service.order",
    routingKeys: ["order.order.confirmed", "order.order.cancelled"],
    handler: (event) => events.handle(event),
  }),
]);

const server = createApp({
  notifications,
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
  logger.info({ port: config.PORT }, "Notification service is listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close((error) => {
    void Promise.allSettled([prisma.$disconnect(), broker.close()]).then(() => {
      mailer.close();
      if (error) {
        logger.error({ err: error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      }
    });
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
