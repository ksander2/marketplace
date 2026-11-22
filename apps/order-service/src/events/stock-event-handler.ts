import type { EventEnvelope } from "@marketplace/contracts";
import { stockRejectedEventSchema, stockReservedEventSchema } from "@marketplace/contracts/order";
import type { OrderService } from "../domain/order-service.js";

export class StockEventHandler {
  constructor(private readonly orders: OrderService) {}

  async handle(event: EventEnvelope): Promise<void> {
    if (event.type === "catalog.stock.reserved") {
      const { orderId } = stockReservedEventSchema.parse(event).payload;
      await this.orders.confirm(orderId, event.correlationId);
      return;
    }
    if (event.type === "catalog.stock.rejected") {
      const { orderId, reason } = stockRejectedEventSchema.parse(event).payload;
      await this.orders.cancel(orderId, reason, event.correlationId);
    }
  }
}
