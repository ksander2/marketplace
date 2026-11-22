import type { StockReservationItem } from "@marketplace/contracts/order";
import type { StockRepository } from "../domain/stock-service.js";
import type { PrismaClient } from "./prisma.js";

class ReservationRejected extends Error {}

export class PrismaStockRepository implements StockRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async reserve(items: StockReservationItem[]): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        const sorted = [...items].sort((left, right) => left.productId.localeCompare(right.productId));
        for (const item of sorted) {
          const result = await transaction.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count !== 1) throw new ReservationRejected();
        }
      });
      return true;
    } catch (error) {
      if (error instanceof ReservationRejected) return false;
      throw error;
    }
  }
}
