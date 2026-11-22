import type { EventEnvelope } from "@marketplace/contracts";
import { orderCreatedEventSchema } from "@marketplace/contracts/order";
import type { StockService } from "../domain/stock-service.js";

export class OrderEventHandler {
  constructor(private readonly stock: StockService) {}

  async handle(event: EventEnvelope): Promise<void> {
    if (event.type !== "order.order.created") return;
    const { orderId, items } = orderCreatedEventSchema.parse(event).payload;
    await this.stock.reserve(orderId, items, event.correlationId);
  }
}
