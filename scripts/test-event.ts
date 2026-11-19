import { randomUUID } from "node:crypto";
import { createLogger } from "@marketplace/common";
import { createEvent, testEventSchema } from "@marketplace/contracts";
import { RabbitMQBroker } from "@marketplace/messaging";

const logger = createLogger({ service: "event-smoke-test" });
const broker = new RabbitMQBroker({
  url: process.env.RABBITMQ_URL ?? "amqp://marketplace:marketplace@localhost:5673",
  logger,
});
const event = createEvent({
  type: "messaging.test.published",
  correlationId: randomUUID(),
  payload: { message: "RabbitMQ publish → consume smoke test" },
});

let timeout: NodeJS.Timeout | undefined;
let resolveReceived!: () => void;
let rejectReceived!: (error: Error) => void;
const received = new Promise<void>((resolve, reject) => {
  resolveReceived = resolve;
  rejectReceived = reject;
});

try {
  await broker.consume({
    queue: `messaging.smoke.${event.eventId}`,
    routingKeys: [event.type],
    durable: false,
    autoDelete: true,
    exclusive: true,
    handler: async (receivedEvent) => {
      try {
        const parsed = testEventSchema.parse(receivedEvent);
        if (parsed.eventId !== event.eventId) {
          throw new Error(`Unexpected event ${parsed.eventId}`);
        }
        resolveReceived();
      } catch (error) {
        rejectReceived(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
  });

  await broker.publish(event);
  await Promise.race([
    received,
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Timed out waiting for the test event")), 10_000);
    }),
  ]);

  logger.info({ eventId: event.eventId }, "Test event passed publish → consume");
} catch (error) {
  logger.error({ err: error }, "Test event failed");
  process.exitCode = 1;
} finally {
  if (timeout) clearTimeout(timeout);
  await broker.close();
}
