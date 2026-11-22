import type { RequestHandler, Response } from "express";
import type { EventEnvelope } from "@marketplace/contracts";
import { orderEventSchema } from "@marketplace/contracts/order";

interface Connection {
  userId: string;
  response: Response;
  heartbeat: NodeJS.Timeout;
}

export class OrderEventStream {
  private readonly connections = new Set<Connection>();

  constructor(private readonly heartbeatIntervalMs = 15_000) {}

  readonly handleRequest: RequestHandler = (request, response) => {
    const userId = request.header("x-user-id");
    if (!userId) {
      response.status(500).json({
        error: { code: "IDENTITY_MISSING", message: "Authenticated user identity is missing" },
      });
      return;
    }

    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    response.flushHeaders();
    response.write("retry: 3000\n\n");

    const connection = {} as Connection;
    const cleanup = () => {
      clearInterval(connection.heartbeat);
      this.connections.delete(connection);
    };
    connection.userId = userId;
    connection.response = response;
    connection.heartbeat = setInterval(() => {
      response.write(": heartbeat\n\n");
    }, this.heartbeatIntervalMs);
    connection.heartbeat.unref();
    this.connections.add(connection);
    response.on("close", cleanup);
  };

  handle(event: EventEnvelope): void {
    if (!event.type.startsWith("order.order.")) return;
    const orderEvent = orderEventSchema.parse(event);
    const message = [
      `id: ${orderEvent.eventId}`,
      `event: ${orderEvent.type}`,
      `data: ${JSON.stringify(orderEvent)}`,
      "",
      "",
    ].join("\n");

    for (const connection of this.connections) {
      if (connection.userId === orderEvent.payload.userId) {
        connection.response.write(message);
      }
    }
  }

  close(): void {
    for (const connection of this.connections) {
      clearInterval(connection.heartbeat);
      connection.response.end();
    }
    this.connections.clear();
  }
}
