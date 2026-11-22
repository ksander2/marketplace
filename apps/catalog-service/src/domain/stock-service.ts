import { createEvent, type EventEnvelope } from "@marketplace/contracts";
import type { StockReservationItem } from "@marketplace/contracts/order";

export interface StockRepository {
  reserve(items: StockReservationItem[]): Promise<boolean>;
}

export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

export class StockService {
  constructor(
    private readonly repository: StockRepository,
    private readonly events: EventPublisher,
  ) {}

  async reserve(orderId: string, items: StockReservationItem[], correlationId: string): Promise<void> {
    const reserved = await this.repository.reserve(items);
    if (reserved) {
      await this.events.publish(createEvent({
        type: "catalog.stock.reserved",
        correlationId,
        payload: { orderId, items },
      }));
      return;
    }
    await this.events.publish(createEvent({
      type: "catalog.stock.rejected",
      correlationId,
      payload: { orderId, reason: "Insufficient product stock" },
    }));
  }
}
