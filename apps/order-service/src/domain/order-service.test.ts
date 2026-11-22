import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { EventEnvelope } from "@marketplace/contracts";
import type { Order } from "@marketplace/contracts/order";
import {
  OrderService,
  type OrderRepository,
  type ProductSnapshot,
} from "./order-service.js";

class InMemoryOrderRepository implements OrderRepository {
  readonly products = new Map<string, ProductSnapshot>();
  readonly orders = new Map<string, Order>();

  list(userId: string): Promise<Order[]> {
    return Promise.resolve([...this.orders.values()].filter((order) => order.userId === userId));
  }

  findById(id: string): Promise<Order | null> {
    return Promise.resolve(this.orders.get(id) ?? null);
  }

  findProduct(id: string): Promise<ProductSnapshot | null> {
    return Promise.resolve(this.products.get(id) ?? null);
  }

  saveProduct(product: ProductSnapshot): Promise<void> {
    this.products.set(product.id, product);
    return Promise.resolve();
  }

  deleteProduct(id: string): Promise<void> {
    this.products.delete(id);
    return Promise.resolve();
  }

  create(input: Pick<Order, "userId" | "items" | "total">): Promise<Order> {
    const now = new Date().toISOString();
    const order: Order = {
      ...input,
      id: randomUUID(),
      status: "PENDING",
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(order.id, order);
    return Promise.resolve(order);
  }

  transition(
    id: string,
    status: "CONFIRMED" | "CANCELLED",
    cancelReason?: string,
  ): Promise<Order | null> {
    const order = this.orders.get(id);
    if (!order || order.status !== "PENDING") return Promise.resolve(null);
    const updated = {
      ...order,
      status,
      cancelReason: cancelReason ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.orders.set(id, updated);
    return Promise.resolve(updated);
  }
}

class InMemoryPublisher {
  readonly events: EventEnvelope[] = [];

  publish(event: EventEnvelope): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

const userId = randomUUID();
const correlationId = randomUUID();
const product: ProductSnapshot = {
  id: randomUUID(),
  sellerId: randomUUID(),
  name: "Order test product",
  price: 125.50,
  currency: "RUB",
  updatedAt: new Date().toISOString(),
};

describe("OrderService", () => {
  let repository: InMemoryOrderRepository;
  let publisher: InMemoryPublisher;
  let service: OrderService;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
    publisher = new InMemoryPublisher();
    service = new OrderService(repository, publisher);
    repository.products.set(product.id, product);
  });

  it("creates a pending order with price snapshots and publishes the saga command", async () => {
    const order = await service.create({
      items: [{ productId: product.id, quantity: 2 }],
    }, userId, correlationId);

    expect(order).toMatchObject({ status: "PENDING", total: 251 });
    expect(order.items[0]).toMatchObject({ name: product.name, unitPrice: 125.50, lineTotal: 251 });
    expect(publisher.events[0]).toMatchObject({
      type: "order.order.created",
      payload: { orderId: order.id, userId },
    });
  });

  it("confirms a pending order and publishes the result", async () => {
    const order = await service.create({ items: [{ productId: product.id, quantity: 1 }] }, userId, correlationId);

    await service.confirm(order.id, correlationId);

    await expect(service.get(order.id, userId, ["buyer"])).resolves.toMatchObject({ status: "CONFIRMED" });
    expect(publisher.events.at(-1)).toMatchObject({
      type: "order.order.confirmed",
      payload: { orderId: order.id, userId },
    });
  });

  it("cancels a rejected order and preserves the reason", async () => {
    const order = await service.create({ items: [{ productId: product.id, quantity: 1 }] }, userId, correlationId);

    await service.cancel(order.id, "Insufficient product stock", correlationId);

    await expect(service.get(order.id, userId, ["buyer"])).resolves.toMatchObject({
      status: "CANCELLED",
      cancelReason: "Insufficient product stock",
    });
    expect(publisher.events.at(-1)?.type).toBe("order.order.cancelled");
  });

  it("rejects missing products and another user's order", async () => {
    await expect(service.create({
      items: [{ productId: randomUUID(), quantity: 1 }],
    }, userId, correlationId)).rejects.toMatchObject({ code: "PRODUCT_NOT_AVAILABLE" });

    const order = await service.create({ items: [{ productId: product.id, quantity: 1 }] }, userId, correlationId);
    await expect(service.get(order.id, randomUUID(), ["buyer"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
