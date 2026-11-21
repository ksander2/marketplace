import { randomUUID } from "node:crypto";
import { authResponseSchema } from "@marketplace/contracts/auth";
import { cartSchema, type Cart } from "@marketplace/contracts/cart";
import { productSchema, type Product } from "@marketplace/contracts/catalog";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const sellerEmail = process.env.SEED_SELLER_EMAIL ?? "seller@marketplace.local";
const sellerPassword = process.env.SEED_SELLER_PASSWORD ?? "seller-password-123";
const buyerEmail = `cart-buyer-${randomUUID()}@example.com`;
const buyerPassword = "very-secure-password";
let sellerToken: string | undefined;
let buyerToken: string | undefined;
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

async function login(email: string, password: string): Promise<string> {
  const response = await call("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expectStatus(response, 200);
  return authResponseSchema.parse(await json(response)).accessToken;
}

async function getCart(token: string): Promise<Cart> {
  const response = await call("/cart", { headers: { authorization: `Bearer ${token}` } });
  expectStatus(response, 200);
  return cartSchema.parse(await json(response));
}

function authorized(token: string, init: RequestInit): RequestInit {
  return {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  };
}

async function waitFor<T>(operation: () => Promise<T>, description: string): Promise<T> {
  const deadline = Date.now() + 10_000;
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
  const unauthorized = await call("/cart");
  expectStatus(unauthorized, 401);

  const registration = await call("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: buyerEmail, name: "Cart Buyer", password: buyerPassword }),
  });
  expectStatus(registration, 201);
  buyerToken = authResponseSchema.parse(await json(registration)).accessToken;
  sellerToken = await login(sellerEmail, sellerPassword);

  const createdResponse = await call("/products", authorized(sellerToken, {
    method: "POST",
    body: JSON.stringify({
      name: `Cart smoke product ${randomUUID()}`,
      description: "Created to verify the Redis cart and product replica",
      category: "Testing",
      price: 100.50,
      stock: 8,
    }),
  }));
  expectStatus(createdResponse, 201);
  const product: Product = productSchema.parse(await json(createdResponse));
  productId = product.id;

  const added = await waitFor(async () => {
    const response = await call("/cart/items", authorized(buyerToken!, {
      method: "POST",
      body: JSON.stringify({ productId: product.id, quantity: 2 }),
    }));
    expectStatus(response, 200);
    return cartSchema.parse(await json(response));
  }, "the catalog.product.created replica");
  if (added.items[0]?.lineTotal !== 201) throw new Error("Initial cart total is incorrect");

  buyerToken = await login(buyerEmail, buyerPassword);
  const restored = await getCart(buyerToken);
  if (restored.items[0]?.quantity !== 2) throw new Error("Cart did not survive a new session");

  const quantityResponse = await call(`/cart/items/${product.id}`, authorized(buyerToken, {
    method: "PUT",
    body: JSON.stringify({ quantity: 3 }),
  }));
  expectStatus(quantityResponse, 200);
  const quantityCart = cartSchema.parse(await json(quantityResponse));
  if (quantityCart.items[0]?.quantity !== 3 || quantityCart.total !== 301.50) {
    throw new Error("Cart quantity or total was not updated");
  }

  const updatedResponse = await call(`/products/${product.id}`, authorized(sellerToken, {
    method: "PUT",
    body: JSON.stringify({ price: 80.25 }),
  }));
  expectStatus(updatedResponse, 200);
  productSchema.parse(await json(updatedResponse));

  const repriced = await waitFor(async () => {
    const current = await getCart(buyerToken!);
    if (current.items[0]?.product.price !== 80.25) {
      throw new Error("Product price has not reached the cart replica");
    }
    return current;
  }, "the catalog.product.updated replica");
  if (repriced.total !== 240.75) throw new Error("Cart total did not use the updated price");

  const removed = await call(`/cart/items/${product.id}`, authorized(buyerToken, { method: "DELETE" }));
  expectStatus(removed, 204);
  if ((await getCart(buyerToken)).items.length !== 0) throw new Error("Cart item was not removed");

  const readded = await call("/cart/items", authorized(buyerToken, {
    method: "POST",
    body: JSON.stringify({ productId: product.id, quantity: 1 }),
  }));
  expectStatus(readded, 200);
  const cleared = await call("/cart", authorized(buyerToken, { method: "DELETE" }));
  expectStatus(cleared, 204);
  if ((await getCart(buyerToken)).items.length !== 0) throw new Error("Cart was not cleared");

  console.log("Cart smoke test passed: unauthorized, Redis persistence, quantity, remove/clear, RabbitMQ price update");
} finally {
  if (buyerToken) {
    await call("/cart", authorized(buyerToken, { method: "DELETE" })).catch(() => undefined);
  }
  if (productId && sellerToken) {
    await call(`/products/${productId}`, authorized(sellerToken, { method: "DELETE" })).catch(() => undefined);
  }
}
