import { AppError } from "@marketplace/common";
import type {
  AddCartItemRequest,
  Cart,
  CartItem,
  UpdateCartItemRequest,
} from "@marketplace/contracts/cart";
import type { Product } from "@marketplace/contracts/catalog";

export interface CartRepository {
  findProduct(id: string): Promise<Product | null>;
  saveProduct(product: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  getQuantities(userId: string): Promise<Record<string, number>>;
  getQuantity(userId: string, productId: string): Promise<number>;
  setQuantity(userId: string, productId: string, quantity: number): Promise<void>;
  removeItem(userId: string, productId: string): Promise<void>;
  clear(userId: string): Promise<void>;
}

export class CartService {
  constructor(private readonly repository: CartRepository) {}

  async get(userId: string): Promise<Cart> {
    const quantities = await this.repository.getQuantities(userId);
    const items: CartItem[] = [];

    for (const [productId, quantity] of Object.entries(quantities)) {
      const product = await this.repository.findProduct(productId);
      if (!product) {
        await this.repository.removeItem(userId, productId);
        continue;
      }
      items.push({
        product,
        quantity,
        lineTotal: round(product.price * quantity),
      });
    }

    items.sort((left, right) => left.product.name.localeCompare(right.product.name));
    return {
      items,
      total: round(items.reduce((sum, item) => sum + item.lineTotal, 0)),
    };
  }

  async add(userId: string, input: AddCartItemRequest): Promise<Cart> {
    const current = await this.repository.getQuantity(userId, input.productId);
    await this.set(userId, input.productId, { quantity: current + input.quantity });
    return this.get(userId);
  }

  async set(userId: string, productId: string, input: UpdateCartItemRequest): Promise<void> {
    const product = await this.repository.findProduct(productId);
    if (!product) throw new AppError("Product is not available", "PRODUCT_NOT_AVAILABLE", 404);
    if (input.quantity > product.stock) {
      throw new AppError("Requested quantity exceeds available stock", "INSUFFICIENT_STOCK", 409);
    }
    await this.repository.setQuantity(userId, productId, input.quantity);
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.repository.removeItem(userId, productId);
  }

  async clear(userId: string): Promise<void> {
    await this.repository.clear(userId);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
