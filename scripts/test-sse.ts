import { randomUUID } from "node:crypto";
import { authResponseSchema } from "@marketplace/contracts/auth";
import { productSchema } from "@marketplace/contracts/catalog";
import { orderEventSchema, orderSchema, type OrderEvent } from "@marketplace/contracts/order";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const sellerEmail = process.env.SEED_SELLER_EMAIL ?? "seller@marketplace.local";
const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? "seller-password-123";
const buyerEmail = `sse-buyer-${randomUUID()}@example.com`;
let buyerToken: string | undefined;
let sellerToken: string | undefined;
let productId: string | undefined;
let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}/api${path}`, init);
}

function expectStatus(response: Response, expected: number): void {
  if (response.status !== expected) {
    throw new Error(`${response.url}: expected ${expected}, received ${response.status}`);
  }
}

async function json(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

function authorized(token: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  };
}

async function waitFor<T>(operation: () => Promise<T>, description: string): Promise<T> {
  const deadline = Date.now() + 15_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Timed out waiting for ${description}: ${String(lastError)}`);
}

try {
  expectStatus(await call("/events/orders"), 401);

  const registration = await call("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: buyerEmail,
      name: "SSE Buyer",
      password: "very-secure-password",
    }),
  });
  expectStatus(registration, 201);
  buyerToken = authResponseSchema.parse(await json(registration)).accessToken;

  const login = await call("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: sellerEmail, password: sellerPassword }),
  });
  expectStatus(login, 200);
  sellerToken = authResponseSchema.parse(await json(login)).accessToken;

  const createdProduct = await call("/products", authorized(sellerToken, {
    method: "POST",
    body: JSON.stringify({
      name: `SSE smoke product ${randomUUID()}`,
      description: "Created to verify order status events over SSE",
      category: "Testing",
      price: 75,
      stock: 5,
    }),
  }));
  expectStatus(createdProduct, 201);
  const product = productSchema.parse(await json(createdProduct));
  productId = product.id;

  const stream = await call("/events/orders", authorized(buyerToken));
  expectStatus(stream, 200);
  if (!stream.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("Order events endpoint did not return an SSE stream");
  }
  if (!stream.body) throw new Error("SSE response body is missing");
  reader = stream.body.getReader();
  const readState = { buffer: "", decoder: new TextDecoder() };

  const createOrder = async (quantity: number) => {
    let response: Response | undefined;
    await waitFor(async () => {
      const result = await call("/orders", authorized(buyerToken!, {
        method: "POST",
        body: JSON.stringify({ items: [{ productId: product.id, quantity }] }),
      }));
      if (result.status === 404) throw new Error("Order product replica is not ready");
      expectStatus(result, 202);
      response = result;
    }, "the order product replica");
    return orderSchema.parse(await json(response!));
  };

  const confirmedOrder = await createOrder(2);
  const createdEvent = await nextEvent("order.order.created", readState);
  if (createdEvent.payload.orderId !== confirmedOrder.id) {
    throw new Error("SSE created event refers to another order");
  }
  const confirmedEvent = await nextEvent("order.order.confirmed", readState);
  if (confirmedEvent.payload.orderId !== confirmedOrder.id) {
    throw new Error("SSE confirmed event refers to another order");
  }

  const cancelledOrder = await createOrder(4);
  const cancelledEvent = await nextEvent("order.order.cancelled", readState);
  if (cancelledEvent.payload.orderId !== cancelledOrder.id) {
    throw new Error("SSE cancelled event refers to another order");
  }
  if (!("reason" in cancelledEvent.payload) || !cancelledEvent.payload.reason) {
    throw new Error("SSE cancellation reason is missing");
  }

  console.log("SSE smoke test passed: JWT guard, created → confirmed and cancelled events received");
} finally {
  if (reader) await reader.cancel().catch(() => undefined);
  if (productId && sellerToken) {
    await call(`/products/${productId}`, authorized(sellerToken, { method: "DELETE" })).catch(() => undefined);
  }
}

async function nextEvent(
  expectedType: OrderEvent["type"],
  state: { buffer: string; decoder: TextDecoder },
): Promise<OrderEvent> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const separator = /\r?\n\r?\n/.exec(state.buffer);
    if (separator) {
      const block = state.buffer.slice(0, separator.index);
      state.buffer = state.buffer.slice(separator.index + separator[0].length);
      const data = block.split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) {
        const event = orderEventSchema.parse(JSON.parse(data));
        if (event.type === expectedType) return event;
      }
      continue;
    }

    const remaining = deadline - Date.now();
    const result = await Promise.race([
      reader!.read(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error(`Timed out waiting for ${expectedType}`)), remaining);
      }),
    ]);
    if (result.done) throw new Error(`SSE stream ended before ${expectedType}`);
    state.buffer += state.decoder.decode(result.value, { stream: true });
  }
  throw new Error(`Timed out waiting for ${expectedType}`);
}
