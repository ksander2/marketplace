import type { EventEnvelope } from "@marketplace/contracts";
import {
  productCreatedEventSchema,
  productDeletedEventSchema,
  productUpdatedEventSchema,
} from "@marketplace/contracts/catalog";
import type { CartRepository } from "../domain/cart-service.js";

export class CatalogEventHandler {
  constructor(private readonly repository: CartRepository) {}

  async handle(event: EventEnvelope): Promise<void> {
    if (event.type === "catalog.product.created") {
      await this.repository.saveProduct(productCreatedEventSchema.parse(event).payload);
      return;
    }
    if (event.type === "catalog.product.updated") {
      await this.repository.saveProduct(productUpdatedEventSchema.parse(event).payload);
      return;
    }
    if (event.type === "catalog.product.deleted") {
      const { productId } = productDeletedEventSchema.parse(event).payload;
      await this.repository.deleteProduct(productId);
    }
  }
}
