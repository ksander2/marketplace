import { AppError } from "@marketplace/common";
import { createEvent, type EventEnvelope } from "@marketplace/contracts";
import type { CreateOrderRequest, Order } from "@marketplace/contracts/order";

export interface ProductSnapshot {
  id: string;
  sellerId: string;
  name: string;
  price: number;
  currency: string;
  updatedAt: string;
}

export interface OrderRepository {
  list(userId: string): Promise<Order[]>;
  findById(id: string): Promise<Order | null>;
  findProduct(id: string): Promise<ProductSnapshot | null>;
  saveProduct(product: ProductSnapshot): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  create(input: Pick<Order, "userId" | "items" | "total">): Promise<Order>;
  transition(id: string, status: "CONFIRMED" | "CANCELLED", cancelReason?: string): Promise<Order | null>;
}

export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly events: EventPublisher,
  ) {}

  list(userId: string): Promise<Order[]> {
    return this.repository.list(userId);
  }

  async get(id: string, userId: string, roles: string[]): Promise<Order> {
    const order = await this.repository.findById(id);
    if (!order) throw new AppError("Order not found", "ORDER_NOT_FOUND", 404);
    if (order.userId !== userId && !roles.includes("admin")) {
      throw new AppError("Only the order owner can view it", "FORBIDDEN", 403);
    }
    return order;
  }

  async create(input: CreateOrderRequest, userId: string, correlationId: string): Promise<Order> {
    const items = [];
    for (const requested of input.items) {
      const product = await this.repository.findProduct(requested.productId);
      if (!product) {
        throw new AppError("Product is not available", "PRODUCT_NOT_AVAILABLE", 404);
      }
      items.push({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: requested.quantity,
        lineTotal: round(product.price * requested.quantity),
      });
    }
    const total = round(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const order = await this.repository.create({ userId, items, total });
    await this.events.publish(createEvent({
      type: "order.order.created",
      correlationId,
      payload: {
        orderId: order.id,
        userId,
        items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      },
    }));
    return order;
  }

  async confirm(id: string, correlationId: string): Promise<void> {
    const order = await this.repository.transition(id, "CONFIRMED");
    if (!order) return;
    await this.events.publish(createEvent({
      type: "order.order.confirmed",
      correlationId,
      payload: { orderId: order.id, userId: order.userId },
    }));
  }

  async cancel(id: string, reason: string, correlationId: string): Promise<void> {
    const order = await this.repository.transition(id, "CANCELLED", reason);
    if (!order) return;
    await this.events.publish(createEvent({
      type: "order.order.cancelled",
      correlationId,
      payload: { orderId: order.id, userId: order.userId, reason },
    }));
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
