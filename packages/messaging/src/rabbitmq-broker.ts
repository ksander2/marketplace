import amqp, {
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
} from "amqplib";
import { createLogger, type Logger } from "@marketplace/common";
import { eventEnvelopeSchema, type EventEnvelope } from "@marketplace/contracts";

export interface RabbitMQBrokerOptions {
  url: string;
  exchange?: string;
  deadLetterExchange?: string;
  reconnectDelayMs?: number;
  logger?: Logger;
}

export interface ConsumeOptions {
  queue: string;
  routingKeys: string[];
  handler: (event: EventEnvelope) => Promise<void>;
  prefetch?: number;
  durable?: boolean;
  autoDelete?: boolean;
  exclusive?: boolean;
}

interface RegisteredConsumer extends ConsumeOptions {
  routingKeys: string[];
}

export class RabbitMQBroker {
  private readonly exchange: string;
  private readonly deadLetterExchange: string;
  private readonly reconnectDelayMs: number;
  private readonly logger: Logger;
  private readonly consumers = new Map<string, RegisteredConsumer>();
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private closing = false;

  constructor(private readonly options: RabbitMQBrokerOptions) {
    this.exchange = options.exchange ?? "marketplace.events";
    this.deadLetterExchange = options.deadLetterExchange ?? "marketplace.dlx";
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1_000;
    this.logger = options.logger ?? createLogger({ service: "messaging" });
  }

  async connect(): Promise<void> {
    if (this.channel) return;
    if (this.connecting) return this.connecting;

    this.closing = false;
    this.connecting = this.openConnection()
      .catch((error: unknown) => {
        this.scheduleReconnect();
        throw error;
      })
      .finally(() => {
        this.connecting = null;
      });

    return this.connecting;
  }

  async publish(event: EventEnvelope): Promise<void> {
    await this.connect();
    const channel = this.channel;
    if (!channel) throw new Error("RabbitMQ channel is not available");

    const validEvent = eventEnvelopeSchema.parse(event);
    const body = Buffer.from(JSON.stringify(validEvent));

    await new Promise<void>((resolve, reject) => {
      channel.publish(
        this.exchange,
        validEvent.type,
        body,
        {
          persistent: true,
          contentType: "application/json",
          messageId: validEvent.eventId,
          correlationId: validEvent.correlationId,
          timestamp: Date.parse(validEvent.occurredAt),
          type: validEvent.type,
          headers: { version: validEvent.version },
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  async consume(options: ConsumeOptions): Promise<void> {
    if (this.consumers.has(options.queue)) {
      throw new Error(`Consumer for queue ${options.queue} is already registered`);
    }

    const consumer: RegisteredConsumer = { ...options, routingKeys: [...options.routingKeys] };

    try {
      await this.connect();
      if (this.consumers.has(options.queue)) {
        throw new Error(`Consumer for queue ${options.queue} is already registered`);
      }
      if (!this.channel) throw new Error("RabbitMQ channel is not available");
      this.consumers.set(options.queue, consumer);
      await this.setupConsumer(this.channel, consumer);
    } catch (error) {
      if (this.consumers.get(options.queue) === consumer) {
        this.consumers.delete(options.queue);
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    const channel = this.channel;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;

    await channel?.close().catch((error: unknown) => {
      this.logger.warn({ err: error }, "Failed to close RabbitMQ channel cleanly");
    });
    await connection?.close().catch((error: unknown) => {
      this.logger.warn({ err: error }, "Failed to close RabbitMQ connection cleanly");
    });
  }

  private async openConnection(): Promise<void> {
    const connection = await amqp.connect(this.options.url);
    const channel = await connection.createConfirmChannel();

    const handleClose = () => {
      if (this.connection !== connection) return;
      this.connection = null;
      this.channel = null;
      this.logger.warn("RabbitMQ connection closed");
      this.scheduleReconnect();
    };

    connection.on("error", (error) => {
      this.logger.error({ err: error }, "RabbitMQ connection error");
    });
    connection.on("close", handleClose);
    channel.on("error", (error) => {
      this.logger.error({ err: error }, "RabbitMQ channel error");
    });
    channel.on("close", () => {
      if (this.closing || this.channel !== channel) return;
      this.logger.warn("RabbitMQ channel closed");
      void connection.close();
    });

    await channel.assertExchange(this.exchange, "topic", { durable: true });
    await channel.assertExchange(this.deadLetterExchange, "topic", { durable: true });

    this.connection = connection;
    this.channel = channel;

    for (const consumer of this.consumers.values()) {
      await this.setupConsumer(channel, consumer);
    }

    this.logger.info("Connected to RabbitMQ");
  }

  private async setupConsumer(
    channel: ConfirmChannel,
    consumer: RegisteredConsumer,
  ): Promise<void> {
    const queueOptions = {
      durable: consumer.durable ?? true,
      autoDelete: consumer.autoDelete ?? false,
      exclusive: consumer.exclusive ?? false,
    };

    await channel.assertQueue(consumer.queue, {
      ...queueOptions,
      arguments: { "x-dead-letter-exchange": this.deadLetterExchange },
    });
    await channel.assertQueue(`${consumer.queue}.dlq`, queueOptions);
    await channel.bindQueue(`${consumer.queue}.dlq`, this.deadLetterExchange, "#");

    for (const routingKey of consumer.routingKeys) {
      await channel.bindQueue(consumer.queue, this.exchange, routingKey);
    }

    await channel.prefetch(consumer.prefetch ?? 10);
    await channel.consume(consumer.queue, (message) => {
      if (!message) return;
      void this.handleMessage(channel, message, consumer);
    });
  }

  private async handleMessage(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    consumer: RegisteredConsumer,
  ): Promise<void> {
    try {
      const event = eventEnvelopeSchema.parse(JSON.parse(message.content.toString("utf8")));
      await consumer.handler(event);
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        { err: error, messageId: message.properties.messageId },
        "Message processing failed; sending it to the DLQ",
      );
      channel.nack(message, false, false);
    }
  }

  private scheduleReconnect(): void {
    if (this.closing || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch((error: unknown) => {
        this.logger.error({ err: error }, "RabbitMQ reconnection attempt failed");
      });
    }, this.reconnectDelayMs);
  }
}
