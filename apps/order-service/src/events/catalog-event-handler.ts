import {
  productCreatedEventSchema,
  productDeletedEventSchema,
  productUpdatedEventSchema,
} from "@marketplace/contracts/catalog";
import type { EventEnvelope } from "@marketplace/contracts";
import type { OrderRepository } from "../domain/order-service.js";

export class CatalogEventHandler {
  constructor(private readonly repository: OrderRepository) {}

  async handle(event: EventEnvelope): Promise<void> {
    if (event.type === "catalog.product.created" || event.type === "catalog.product.updated") {
      const { payload } = event.type === "catalog.product.created"
        ? productCreatedEventSchema.parse(event)
        : productUpdatedEventSchema.parse(event);
      await this.repository.saveProduct({
        id: payload.id,
        sellerId: payload.sellerId,
        name: payload.name,
        price: payload.price,
        currency: payload.currency,
        updatedAt: payload.updatedAt,
      });
      return;
    }
    if (event.type === "catalog.product.deleted") {
      const { productId } = productDeletedEventSchema.parse(event).payload;
      await this.repository.deleteProduct(productId);
    }
  }
}
