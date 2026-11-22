import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { EventEnvelope } from "@marketplace/contracts";
import type { StockReservationItem } from "@marketplace/contracts/order";
import { StockService, type StockRepository } from "./stock-service.js";

class InMemoryStockRepository implements StockRepository {
  reserved = true;
  items: StockReservationItem[] = [];

  reserve(items: StockReservationItem[]): Promise<boolean> {
    this.items = items;
    return Promise.resolve(this.reserved);
  }
}

class InMemoryPublisher {
  readonly events: EventEnvelope[] = [];

  publish(event: EventEnvelope): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

describe("StockService", () => {
  let repository: InMemoryStockRepository;
  let publisher: InMemoryPublisher;
  let service: StockService;
  const orderId = randomUUID();
  const items = [{ productId: randomUUID(), quantity: 2 }];

  beforeEach(() => {
    repository = new InMemoryStockRepository();
    publisher = new InMemoryPublisher();
    service = new StockService(repository, publisher);
  });

  it("publishes reserved after successful stock allocation", async () => {
    await service.reserve(orderId, items, randomUUID());

    expect(repository.items).toEqual(items);
    expect(publisher.events[0]).toMatchObject({
      type: "catalog.stock.reserved",
      payload: { orderId, items },
    });
  });

  it("publishes rejected when stock is insufficient", async () => {
    repository.reserved = false;

    await service.reserve(orderId, items, randomUUID());

    expect(publisher.events[0]).toMatchObject({
      type: "catalog.stock.rejected",
      payload: { orderId, reason: "Insufficient product stock" },
    });
  });
});
