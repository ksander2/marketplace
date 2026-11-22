import type { EventEnvelope } from "@marketplace/contracts";
import { orderConfirmedEventSchema } from "@marketplace/contracts/order";
import type { CartRepository } from "../domain/cart-service.js";

export class OrderEventHandler {
  constructor(private readonly repository: CartRepository) {}

  async handle(event: EventEnvelope): Promise<void> {
    if (event.type !== "order.order.confirmed") return;
    const { userId } = orderConfirmedEventSchema.parse(event).payload;
    await this.repository.clear(userId);
  }
}
