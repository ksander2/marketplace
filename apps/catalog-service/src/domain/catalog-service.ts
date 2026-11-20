import { AppError } from "@marketplace/common";
import {
  createEvent,
  type EventEnvelope,
} from "@marketplace/contracts";
import type {
  CreateProductRequest,
  Product,
  UpdateProductRequest,
} from "@marketplace/contracts/catalog";

export interface Actor {
  id: string;
  roles: string[];
}

export interface CatalogRepository {
  list(sellerId?: string): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(input: CreateProductRequest & { sellerId: string }): Promise<Product>;
  update(id: string, input: UpdateProductRequest): Promise<Product>;
  delete(id: string): Promise<void>;
}

export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly events: EventPublisher,
  ) {}

  list(sellerId?: string): Promise<Product[]> {
    return this.repository.list(sellerId);
  }

  async get(id: string): Promise<Product> {
    const product = await this.repository.findById(id);
    if (!product) throw new AppError("Product not found", "PRODUCT_NOT_FOUND", 404);
    return product;
  }

  async create(
    input: CreateProductRequest,
    actor: Actor,
    correlationId: string,
  ): Promise<Product> {
    this.requireSeller(actor);
    const product = await this.repository.create({ ...input, sellerId: actor.id });
    await this.events.publish(createEvent({
      type: "catalog.product.created",
      correlationId,
      payload: product,
    }));
    return product;
  }

  async update(
    id: string,
    input: UpdateProductRequest,
    actor: Actor,
    correlationId: string,
  ): Promise<Product> {
    const current = await this.get(id);
    this.requireOwner(current, actor);
    const product = await this.repository.update(id, input);
    await this.events.publish(createEvent({
      type: "catalog.product.updated",
      correlationId,
      payload: product,
    }));
    return product;
  }

  async delete(id: string, actor: Actor, correlationId: string): Promise<void> {
    const product = await this.get(id);
    this.requireOwner(product, actor);
    await this.repository.delete(id);
    await this.events.publish(createEvent({
      type: "catalog.product.deleted",
      correlationId,
      payload: { productId: id },
    }));
  }

  private requireSeller(actor: Actor): void {
    if (!actor.roles.some((role) => role === "seller" || role === "admin")) {
      throw new AppError("Seller or admin role is required", "FORBIDDEN", 403);
    }
  }

  private requireOwner(product: Product, actor: Actor): void {
    this.requireSeller(actor);
    if (actor.roles.includes("admin") || product.sellerId === actor.id) return;
    throw new AppError("Only the product owner can change it", "FORBIDDEN", 403);
  }
}
