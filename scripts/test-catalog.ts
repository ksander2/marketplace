import { randomUUID } from "node:crypto";
import { createLogger } from "@marketplace/common";
import { authResponseSchema } from "@marketplace/contracts/auth";
import {
  productCreatedEventSchema,
  productDeletedEventSchema,
  productSchema,
  productUpdatedEventSchema,
  type Product,
} from "@marketplace/contracts/catalog";
import type { EventEnvelope } from "@marketplace/contracts";
import { RabbitMQBroker } from "@marketplace/messaging";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const sellerEmail = process.env.SEED_SELLER_EMAIL ?? "seller@marketplace.local";
const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? "seller-password-123";
const logger = createLogger({ service: "catalog-smoke-test" });
const broker = new RabbitMQBroker({
  url: process.env.RABBITMQ_URL ?? "amqp://marketplace:marketplace@localhost:5673",
  logger,
});
const events = new Map<string, EventEnvelope>();

async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}/api${path}`, init);
}

function expectStatus(response: Response, expected: number): void {
  if (response.status !== expected) {
    throw new Error(`${response.url}: expected ${expected}, received ${response.status}`);
  }
}

async function waitForEvent(type: string): Promise<EventEnvelope> {
  const deadline = Date.now() + 10_000;
  while (!events.has(type)) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${type}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return events.get(type)!;
}

let productId: string | undefined;
let sellerToken: string | undefined;
try {
  await broker.consume({
    queue: `catalog.smoke.${randomUUID()}`,
    routingKeys: ["catalog.product.*"],
    durable: false,
    autoDelete: true,
    exclusive: true,
    handler: async (event) => {
      if (event.type === "catalog.product.created") productCreatedEventSchema.parse(event);
      if (event.type === "catalog.product.updated") productUpdatedEventSchema.parse(event);
      if (event.type === "catalog.product.deleted") productDeletedEventSchema.parse(event);
      events.set(event.type, event);
    },
  });

  const buyerRegistration = await call("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `catalog-buyer-${randomUUID()}@example.com`,
      name: "Catalog Buyer",
      password: "very-secure-password",
    }),
  });
  expectStatus(buyerRegistration, 201);
  const buyer = authResponseSchema.parse(await buyerRegistration.json());
  const forbidden = await call("/products", {
    method: "POST",
    headers: {
      authorization: `Bearer ${buyer.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Forbidden product",
      description: "A buyer must not be allowed to create this",
      category: "Testing",
      price: 100,
      stock: 1,
    }),
  });
  expectStatus(forbidden, 403);

  const sellerLogin = await call("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: sellerEmail, password: sellerPassword }),
  });
  expectStatus(sellerLogin, 200);
  sellerToken = authResponseSchema.parse(await sellerLogin.json()).accessToken;

  const createdResponse = await call("/products", {
    method: "POST",
    headers: { authorization: `Bearer ${sellerToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: `Smoke product ${randomUUID()}`,
      description: "Created by the catalog end-to-end smoke test",
      category: "Testing",
      price: 1499.90,
      stock: 7,
    }),
  });
  expectStatus(createdResponse, 201);
  const created = productSchema.parse(await createdResponse.json());
  productId = created.id;
  const createdEvent = productCreatedEventSchema.parse(await waitForEvent("catalog.product.created"));
  if (createdEvent.payload.id !== created.id) throw new Error("Unexpected created event payload");

  const listResponse = await call("/products");
  expectStatus(listResponse, 200);
  const listBody: unknown = await listResponse.json();
  if (!Array.isArray(listBody)) throw new Error("Catalog response is not an array");
  const products = listBody.map((item) => productSchema.parse(item));
  if (!products.some((product) => product.id === created.id)) {
    throw new Error("Created product is missing from the public catalog");
  }

  const getResponse = await call(`/products/${created.id}`);
  expectStatus(getResponse, 200);
  productSchema.parse(await getResponse.json());

  const updatedResponse = await call(`/products/${created.id}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${sellerToken}`, "content-type": "application/json" },
    body: JSON.stringify({ price: 1299.90, stock: 5 }),
  });
  expectStatus(updatedResponse, 200);
  const updated: Product = productSchema.parse(await updatedResponse.json());
  if (updated.price !== 1299.90 || updated.stock !== 5) throw new Error("Product was not updated");
  await waitForEvent("catalog.product.updated");

  const deletedResponse = await call(`/products/${created.id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${sellerToken}` },
  });
  expectStatus(deletedResponse, 204);
  await waitForEvent("catalog.product.deleted");
  productId = undefined;

  const missingResponse = await call(`/products/${created.id}`);
  expectStatus(missingResponse, 404);
  console.log("Catalog smoke test passed: buyer 403, create, public list/get, update, delete, RabbitMQ events");
} catch (error) {
  logger.error({ err: error }, "Catalog smoke test failed");
  process.exitCode = 1;
} finally {
  if (productId && sellerToken) {
    await call(`/products/${productId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${sellerToken}` },
    }).catch(() => undefined);
  }
  await broker.close();
}
