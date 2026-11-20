import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { EventEnvelope } from "@marketplace/contracts";
import type { CreateProductRequest, Product, UpdateProductRequest } from "@marketplace/contracts/catalog";
import {
  CatalogService,
  type Actor,
  type CatalogRepository,
  type EventPublisher,
} from "./catalog-service.js";

class InMemoryCatalogRepository implements CatalogRepository {
  readonly products = new Map<string, Product>();

  list(sellerId?: string): Promise<Product[]> {
    const products = [...this.products.values()];
    return Promise.resolve(sellerId ? products.filter((product) => product.sellerId === sellerId) : products);
  }

  findById(id: string): Promise<Product | null> {
    return Promise.resolve(this.products.get(id) ?? null);
  }

  create(input: CreateProductRequest & { sellerId: string }): Promise<Product> {
    const now = new Date().toISOString();
    const product: Product = {
      ...input,
      id: randomUUID(),
      imageUrl: input.imageUrl ?? null,
      currency: "RUB",
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(product.id, product);
    return Promise.resolve(product);
  }

  update(id: string, input: UpdateProductRequest): Promise<Product> {
    const current = this.products.get(id);
    if (!current) return Promise.reject(new Error("Product not found"));
    const product = { ...current, ...input, updatedAt: new Date().toISOString() };
    this.products.set(id, product);
    return Promise.resolve(product);
  }

  delete(id: string): Promise<void> {
    this.products.delete(id);
    return Promise.resolve();
  }
}

class InMemoryPublisher implements EventPublisher {
  readonly events: EventEnvelope[] = [];

  publish(event: EventEnvelope): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

const input: CreateProductRequest = {
  name: "Test product",
  description: "A sufficiently detailed product description",
  category: "Testing",
  price: 1999.99,
  stock: 10,
};
const seller: Actor = { id: randomUUID(), roles: ["seller"] };

describe("CatalogService", () => {
  let repository: InMemoryCatalogRepository;
  let publisher: InMemoryPublisher;
  let service: CatalogService;

  beforeEach(() => {
    repository = new InMemoryCatalogRepository();
    publisher = new InMemoryPublisher();
    service = new CatalogService(repository, publisher);
  });

  it("creates a seller product and publishes its event", async () => {
    const product = await service.create(input, seller, randomUUID());

    expect(product.sellerId).toBe(seller.id);
    expect(repository.products.get(product.id)).toEqual(product);
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toMatchObject({
      type: "catalog.product.created",
      payload: product,
    });
  });

  it("rejects product creation by a buyer", async () => {
    await expect(
      service.create(input, { id: randomUUID(), roles: ["buyer"] }, randomUUID()),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    expect(publisher.events).toHaveLength(0);
  });

  it("rejects changes from another seller", async () => {
    const product = await service.create(input, seller, randomUUID());

    await expect(
      service.update(product.id, { price: 1 }, { id: randomUUID(), roles: ["seller"] }, randomUUID()),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });

  it("allows an admin to update and delete any product", async () => {
    const product = await service.create(input, seller, randomUUID());
    const admin: Actor = { id: randomUUID(), roles: ["admin"] };

    await expect(
      service.update(product.id, { stock: 3 }, admin, randomUUID()),
    ).resolves.toMatchObject({ stock: 3 });
    await service.delete(product.id, admin, randomUUID());

    expect(repository.products.has(product.id)).toBe(false);
    expect(publisher.events.map((event) => event.type)).toEqual([
      "catalog.product.created",
      "catalog.product.updated",
      "catalog.product.deleted",
    ]);
  });
});
