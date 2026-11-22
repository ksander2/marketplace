import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authResponseSchema } from "@marketplace/contracts/auth";
import { cartSchema } from "@marketplace/contracts/cart";
import { productSchema } from "@marketplace/contracts/catalog";
import { notificationSchema, type Notification, type NotificationType } from "@marketplace/contracts/notification";
import { orderSchema } from "@marketplace/contracts/order";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const mailhogUrl = process.env.MAILHOG_URL ?? "http://localhost:8025";
const sellerEmail = process.env.SEED_SELLER_EMAIL ?? "seller@marketplace.local";
const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? "seller-password-123";
const buyerEmail = `notification-buyer-${randomUUID()}@example.com`;
let buyerToken: string | undefined;
let sellerToken: string | undefined;
let productId: string | undefined;

const mailhogResponseSchema = z.object({
  items: z.array(z.object({
    To: z.array(z.object({ Mailbox: z.string(), Domain: z.string() })),
    Content: z.object({
      Headers: z.record(z.string(), z.array(z.string())),
      Body: z.string(),
    }),
  })),
});

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
  const deadline = Date.now() + 20_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`Timed out waiting for ${description}: ${String(lastError)}`);
}

async function listNotifications(): Promise<Notification[]> {
  const response = await call("/notifications", authorized(buyerToken!));
  expectStatus(response, 200);
  const body = await json(response);
  if (!Array.isArray(body)) throw new Error("Notification list is not an array");
  return body.map((notification) => notificationSchema.parse(notification));
}

async function waitForNotification(type: NotificationType, orderId?: string): Promise<Notification> {
  return waitFor(async () => {
    const notifications = await listNotifications();
    const notification = notifications.find((item) =>
      item.type === type && item.orderId === (orderId ?? null) && item.emailSentAt !== null);
    if (!notification) throw new Error(`${type} notification is not ready`);
    return notification;
  }, `${type} notification and email delivery`);
}

async function waitForEmail(subjectPart: string): Promise<void> {
  await waitFor(async () => {
    const response = await fetch(`${mailhogUrl}/api/v2/messages`);
    expectStatus(response, 200);
    const messages = mailhogResponseSchema.parse(await json(response)).items;
    const found = messages.some((message) => {
      const recipient = message.To.some((to) => `${to.Mailbox}@${to.Domain}` === buyerEmail);
      const subject = message.Content.Headers.Subject ?? [];
      const body = Buffer.from(message.Content.Body.replace(/\s/g, ""), "base64").toString("utf8");
      return recipient && (
        subject.some((value) => value.includes(subjectPart)) ||
        message.Content.Body.includes(subjectPart) || body.includes(subjectPart)
      );
    });
    if (!found) throw new Error(`Email containing ${subjectPart} is not present`);
  }, `Mailhog email ${subjectPart}`);
}

async function createOrder(product: { id: string }, quantity: number) {
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
}

try {
  expectStatus(await call("/notifications"), 401);

  const registration = await call("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: buyerEmail,
      name: "Notification Buyer",
      password: "very-secure-password",
    }),
  });
  expectStatus(registration, 201);
  buyerToken = authResponseSchema.parse(await json(registration)).accessToken;

  await waitForNotification("WELCOME");
  await waitForEmail("");

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
      name: `Notification E2E product ${randomUUID()}`,
      description: "Created to verify registration, cart, order, in-app and email notifications",
      category: "Testing",
      price: 60,
      stock: 5,
    }),
  }));
  expectStatus(createdProduct, 201);
  const product = productSchema.parse(await json(createdProduct));
  productId = product.id;

  await waitFor(async () => {
    const response = await call("/cart/items", authorized(buyerToken!, {
      method: "POST",
      body: JSON.stringify({ productId: product.id, quantity: 2 }),
    }));
    expectStatus(response, 200);
    cartSchema.parse(await json(response));
  }, "the cart product replica");

  const confirmedOrder = await createOrder(product, 2);
  const confirmedNotification = await waitForNotification("ORDER_CONFIRMED", confirmedOrder.id);
  await waitForEmail(confirmedOrder.id);

  const readResponse = await call(
    `/notifications/${confirmedNotification.id}/read`,
    authorized(buyerToken, { method: "PATCH" }),
  );
  expectStatus(readResponse, 200);
  if (!notificationSchema.parse(await json(readResponse)).readAt) {
    throw new Error("Notification was not marked as read");
  }

  const cancelledOrder = await createOrder(product, 4);
  const cancelledNotification = await waitForNotification("ORDER_CANCELLED", cancelledOrder.id);
  if (!cancelledNotification.message.includes("Insufficient product stock")) {
    throw new Error("Cancellation notification does not contain the reason");
  }
  await waitForEmail(cancelledOrder.id);

  console.log("Notification E2E passed: registration → welcome email → cart → confirmed/cancelled orders → in-app and Mailhog");
} finally {
  if (buyerToken) {
    await call("/cart", authorized(buyerToken, { method: "DELETE" })).catch(() => undefined);
  }
  if (productId && sellerToken) {
    await call(`/products/${productId}`, authorized(sellerToken, { method: "DELETE" })).catch(() => undefined);
  }
}
