import { productSchema, type Product } from "@marketplace/contracts/catalog";
import type { CartRepository } from "../domain/cart-service.js";
import type { RedisClient } from "./redis.js";

export class RedisCartRepository implements CartRepository {
  constructor(private readonly redis: RedisClient) {}

  async findProduct(id: string): Promise<Product | null> {
    const value = await this.redis.get(productKey(id));
    return value ? productSchema.parse(JSON.parse(value)) : null;
  }

  async saveProduct(product: Product): Promise<void> {
    await this.redis.set(productKey(product.id), JSON.stringify(product));
  }

  async deleteProduct(id: string): Promise<void> {
    await this.redis.del(productKey(id));
  }

  async getQuantities(userId: string): Promise<Record<string, number>> {
    const values = await this.redis.hGetAll(cartKey(userId));
    return Object.fromEntries(
      Object.entries(values).map(([productId, quantity]) => [productId, Number(quantity)]),
    );
  }

  async getQuantity(userId: string, productId: string): Promise<number> {
    const value = await this.redis.hGet(cartKey(userId), productId);
    return value ? Number(value) : 0;
  }

  async setQuantity(userId: string, productId: string, quantity: number): Promise<void> {
    await this.redis.hSet(cartKey(userId), productId, quantity);
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    await this.redis.hDel(cartKey(userId), productId);
  }

  async clear(userId: string): Promise<void> {
    await this.redis.del(cartKey(userId));
  }
}

function productKey(id: string): string {
  return `cart:product:${id}`;
}

function cartKey(userId: string): string {
  return `cart:user:${userId}`;
}
