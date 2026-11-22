import { orderStatusSchema, type Order } from "@marketplace/contracts/order";
import type { OrderRepository, ProductSnapshot } from "../domain/order-service.js";
import type { PrismaClient } from "./prisma.js";

interface DecimalValue {
  toNumber(): number;
}

interface OrderModel {
  id: string;
  userId: string;
  status: string;
  total: DecimalValue;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    productId: string;
    name: string;
    unitPrice: DecimalValue;
    quantity: number;
    lineTotal: DecimalValue;
  }>;
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string): Promise<Order[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(toOrder);
  }

  async findById(id: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    return order ? toOrder(order) : null;
  }

  async findProduct(id: string): Promise<ProductSnapshot | null> {
    const product = await this.prisma.productSnapshot.findUnique({ where: { id } });
    return product ? toProduct(product) : null;
  }

  async saveProduct(product: ProductSnapshot): Promise<void> {
    await this.prisma.productSnapshot.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        sellerId: product.sellerId,
        name: product.name,
        price: product.price,
        currency: product.currency,
        updatedAt: new Date(product.updatedAt),
      },
      update: {
        sellerId: product.sellerId,
        name: product.name,
        price: product.price,
        currency: product.currency,
        updatedAt: new Date(product.updatedAt),
      },
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.prisma.productSnapshot.deleteMany({ where: { id } });
  }

  async create(input: Pick<Order, "userId" | "items" | "total">): Promise<Order> {
    const order = await this.prisma.order.create({
      data: {
        userId: input.userId,
        total: input.total,
        items: { create: input.items },
      },
      include: { items: true },
    });
    return toOrder(order);
  }

  async transition(
    id: string,
    status: "CONFIRMED" | "CANCELLED",
    cancelReason?: string,
  ): Promise<Order | null> {
    const result = await this.prisma.order.updateMany({
      where: { id, status: "PENDING" },
      data: { status, ...(cancelReason === undefined ? {} : { cancelReason }) },
    });
    return result.count === 1 ? this.findById(id) : null;
  }
}

function toProduct(model: {
  id: string;
  sellerId: string;
  name: string;
  price: DecimalValue;
  currency: string;
  updatedAt: Date;
}): ProductSnapshot {
  return {
    id: model.id,
    sellerId: model.sellerId,
    name: model.name,
    price: model.price.toNumber(),
    currency: model.currency,
    updatedAt: model.updatedAt.toISOString(),
  };
}

function toOrder(model: OrderModel): Order {
  return {
    id: model.id,
    userId: model.userId,
    status: orderStatusSchema.parse(model.status),
    items: model.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      unitPrice: item.unitPrice.toNumber(),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toNumber(),
    })),
    total: model.total.toNumber(),
    cancelReason: model.cancelReason,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}
