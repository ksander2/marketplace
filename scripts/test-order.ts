import { randomUUID } from "node:crypto";
import { authResponseSchema } from "@marketplace/contracts/auth";
import { cartSchema, type Cart } from "@marketplace/contracts/cart";
import { productSchema } from "@marketplace/contracts/catalog";
import { orderSchema, type Order, type OrderStatus } from "@marketplace/contracts/order";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const sellerEmail = process.env.SEED_SELLER_EMAIL ?? "seller@marketplace.local";
const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? "seller-password-123";
const buyerEmail = `order-buyer-${randomUUID()}@example.com`;
let buyerToken: string | undefined;
let sellerToken: string | undefined;
let productId: string | undefined;

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

async function getOrder(id: string, token: string): Promise<Order> {
  const response = await call(`/orders/${id}`, authorized(token));
  expectStatus(response, 200);
  return orderSchema.parse(await json(response));
}

async function getCart(token: string): Promise<Cart> {
  const response = await call("/cart", authorized(token));
  expectStatus(response, 200);
  return cartSchema.parse(await json(response));
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

async function waitForStatus(id: string, status: OrderStatus): Promise<Order> {
  return waitFor(async () => {
    const order = await getOrder(id, buyerToken!);
    if (order.status !== status) throw new Error(`Order is still ${order.status}`);
    return order;
  }, `order status ${status}`);
}

try {
  expectStatus(await call("/orders"), 401);

  const registration = await call("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: buyerEmail,
      name: "Order Buyer",
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
      name: `Order smoke product ${randomUUID()}`,
      description: "Created to verify the complete order saga",
      category: "Testing",
      price: 50,
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

  let createdOrderResponse: Response | undefined;
  await waitFor(async () => {
    const response = await call("/orders", authorized(buyerToken!, {
      method: "POST",
      body: JSON.stringify({ items: [{ productId: product.id, quantity: 2 }] }),
    }));
    if (response.status === 404) throw new Error("Order product replica is not ready");
    expectStatus(response, 202);
    createdOrderResponse = response;
  }, "the order product replica");
  if (!createdOrderResponse) throw new Error("Order was not created");
  const createdOrder = orderSchema.parse(await json(createdOrderResponse));
  if (createdOrder.status !== "PENDING" || createdOrder.total !== 100) {
    throw new Error("Initial order state or price snapshot is incorrect");
  }

  const confirmed = await waitForStatus(createdOrder.id, "CONFIRMED");
  if (confirmed.items[0]?.unitPrice !== 50) throw new Error("Confirmed order lost its price snapshot");
  await waitFor(async () => {
    const cart = await getCart(buyerToken!);
    if (cart.items.length !== 0) throw new Error("Cart is not empty yet");
  }, "cart clearing after confirmation");

  const stockResponse = await call(`/products/${product.id}`);
  expectStatus(stockResponse, 200);
  const reservedProduct = productSchema.parse(await json(stockResponse));
  if (reservedProduct.stock !== 3) throw new Error("Confirmed order did not reserve two items");

  const rejectedOrderResponse = await call("/orders", authorized(buyerToken, {
    method: "POST",
    body: JSON.stringify({ items: [{ productId: product.id, quantity: 4 }] }),
  }));
  expectStatus(rejectedOrderResponse, 202);
  const rejectedOrder = orderSchema.parse(await json(rejectedOrderResponse));
  const cancelled = await waitForStatus(rejectedOrder.id, "CANCELLED");
  if (!cancelled.cancelReason) throw new Error("Cancellation reason is missing");

  const finalStockResponse = await call(`/products/${product.id}`);
  const finalProduct = productSchema.parse(await json(finalStockResponse));
  if (finalProduct.stock !== 3) throw new Error("Rejected order changed product stock");

  const listResponse = await call("/orders", authorized(buyerToken));
  expectStatus(listResponse, 200);
  const listBody: unknown = await json(listResponse);
  if (!Array.isArray(listBody)) throw new Error("Order list response is not an array");
  const orders = listBody.map((order) => orderSchema.parse(order));
  if (!orders.some((order) => order.id === confirmed.id) || !orders.some((order) => order.id === cancelled.id)) {
    throw new Error("Order list is incomplete");
  }

  console.log("Order smoke test passed: PENDING → CONFIRMED, stock reserved, cart cleared, insufficient stock → CANCELLED");
} finally {
  if (buyerToken) {
    await call("/cart", authorized(buyerToken, { method: "DELETE" })).catch(() => undefined);
  }
  if (productId && sellerToken) {
    await call(`/products/${productId}`, authorized(sellerToken, { method: "DELETE" })).catch(() => undefined);
  }
}
