import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEvent } from "@marketplace/contracts";
import { OrderEventStream } from "./order-event-stream.js";

interface ReadState {
  buffer: string;
}

describe("OrderEventStream", () => {
  let server: Server;
  let stream: OrderEventStream;
  let baseUrl: string;

  beforeEach(async () => {
    stream = new OrderEventStream(20);
    const app = express();
    app.get("/events/:userId", (request, response) => {
      request.headers["x-user-id"] = request.params.userId;
      stream.handleRequest(request, response, () => undefined);
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    stream.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("sends order events only to their owner and emits heartbeats", async () => {
    const userId = randomUUID();
    const response = await fetch(`${baseUrl}/events/${userId}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const state: ReadState = { buffer: "" };
    const decoder = new TextDecoder();

    try {
      await readUntil(reader, state, decoder, "retry: 3000");
      const otherEvent = createEvent({
        type: "order.order.confirmed",
        correlationId: randomUUID(),
        payload: { orderId: randomUUID(), userId: randomUUID() },
      });
      const ownerEvent = createEvent({
        type: "order.order.confirmed",
        correlationId: randomUUID(),
        payload: { orderId: randomUUID(), userId },
      });

      stream.handle(otherEvent);
      stream.handle(ownerEvent);
      const eventText = await readUntil(reader, state, decoder, ownerEvent.eventId);
      expect(eventText).not.toContain(otherEvent.eventId);
      expect(eventText).toContain("event: order.order.confirmed");
      expect(eventText).toContain(`"orderId":"${ownerEvent.payload.orderId}"`);
      await readUntil(reader, state, decoder, ": heartbeat");
    } finally {
      await reader.cancel();
    }
  });
});

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  state: ReadState,
  decoder: TextDecoder,
  marker: string,
): Promise<string> {
  const deadline = Date.now() + 2_000;
  while (!state.buffer.includes(marker)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`Timed out waiting for ${marker}`);
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error(`Timed out waiting for ${marker}`)), remaining);
      }),
    ]);
    if (result.done) throw new Error(`Stream ended before ${marker}`);
    state.buffer += decoder.decode(result.value, { stream: true });
  }
  return state.buffer;
}
