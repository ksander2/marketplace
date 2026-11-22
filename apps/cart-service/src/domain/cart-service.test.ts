import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createEvent } from "@marketplace/contracts";
import type { Product } from "@marketplace/contracts/catalog";
import type { CartRepository } from "./cart-service.js";
import { CartService } from "./cart-service.js";
import { CatalogEventHandler } from "../events/catalog-event-handler.js";
import { OrderEventHandler } from "../events/order-event-handler.js";

class InMemoryCartRepository implements CartRepository {
  readonly products = new Map<string, Product>();
  readonly carts = new Map<string, Map<string, number>>();

  findProduct(id: string): Promise<Product | null> {
    return Promise.resolve(this.products.get(id) ?? null);
  }

  saveProduct(product: Product): Promise<void> {
    this.products.set(product.id, product);
    return Promise.resolve();
  }

  deleteProduct(id: string): Promise<void> {
    this.products.delete(id);
    return Promise.resolve();
  }

  getQuantities(userId: string): Promise<Record<string, number>> {
    return Promise.resolve(Object.fromEntries(this.cart(userId)));
  }

  getQuantity(userId: string, productId: string): Promise<number> {
    return Promise.resolve(this.cart(userId).get(productId) ?? 0);
  }

  setQuantity(userId: string, productId: string, quantity: number): Promise<void> {
    this.cart(userId).set(productId, quantity);
    return Promise.resolve();
  }

  removeItem(userId: string, productId: string): Promise<void> {
    this.cart(userId).delete(productId);
    return Promise.resolve();
  }

  clear(userId: string): Promise<void> {
    this.carts.delete(userId);
    return Promise.resolve();
  }

  private cart(userId: string): Map<string, number> {
    let cart = this.carts.get(userId);
    if (!cart) {
      cart = new Map<string, number>();
      this.carts.set(userId, cart);
    }
    return cart;
  }
}

const product: Product = {
  id: randomUUID(),
  sellerId: randomUUID(),
  name: "Cart test product",
  description: "A product used by cart domain tests",
  category: "Testing",
  price: 100.50,
  currency: "RUB",
  stock: 5,
  imageUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const userId = randomUUID();
const correlationId = randomUUID();

describe("CartService", () => {
  let repository: InMemoryCartRepository;
  let service: CartService;
  let events: CatalogEventHandler;

  beforeEach(() => {
    repository = new InMemoryCartRepository();
    service = new CartService(repository);
    events = new CatalogEventHandler(repository);
  });

  it("keeps a user cart independently of service instances", async () => {
    await repository.saveProduct(product);
    await service.add(userId, { productId: product.id, quantity: 2 });

    const restored = await new CartService(repository).get(userId);
    expect(restored).toEqual({
      items: [{ product, quantity: 2, lineTotal: 201 }],
      total: 201,
    });
  });

  it("uses the updated product snapshot and price", async () => {
    await events.handle(createEvent({ type: "catalog.product.created", payload: product, correlationId }));
    await service.add(userId, { productId: product.id, quantity: 2 });
    const updated = { ...product, price: 75.25, updatedAt: new Date().toISOString() };

    await events.handle(createEvent({ type: "catalog.product.updated", payload: updated, correlationId }));

    await expect(service.get(userId)).resolves.toEqual({
      items: [{ product: updated, quantity: 2, lineTotal: 150.50 }],
      total: 150.50,
    });
  });

  it("rejects unavailable products and quantities above stock", async () => {
    await expect(
      service.add(userId, { productId: product.id, quantity: 1 }),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_AVAILABLE", statusCode: 404 });

    await repository.saveProduct(product);
    await expect(
      service.add(userId, { productId: product.id, quantity: 6 }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", statusCode: 409 });
  });

  it("removes deleted products when the cart is read", async () => {
    await repository.saveProduct(product);
    await service.add(userId, { productId: product.id, quantity: 1 });

    await events.handle(createEvent({
      type: "catalog.product.deleted",
      payload: { productId: product.id },
      correlationId,
    }));

    await expect(service.get(userId)).resolves.toEqual({ items: [], total: 0 });
    expect(repository.carts.get(userId)?.has(product.id)).toBe(false);
  });

  it("clears the cart after order confirmation", async () => {
    await repository.saveProduct(product);
    await service.add(userId, { productId: product.id, quantity: 1 });
    const orders = new OrderEventHandler(repository);

    await orders.handle(createEvent({
      type: "order.order.confirmed",
      payload: { orderId: randomUUID(), userId },
      correlationId,
    }));

    await expect(service.get(userId)).resolves.toEqual({ items: [], total: 0 });
  });
});
