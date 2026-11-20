import type { CreateProductRequest, Product, UpdateProductRequest } from "@marketplace/contracts/catalog";
import type { CatalogRepository } from "../domain/catalog-service.js";
import type { PrismaClient } from "./prisma.js";

interface ProductModel {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  category: string;
  price: { toNumber(): number };
  currency: string;
  stock: number;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(sellerId?: string): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: sellerId ? { sellerId } : {},
      orderBy: { createdAt: "desc" },
    });
    return products.map(toProduct);
  }

  async findById(id: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    return product ? toProduct(product) : null;
  }

  async create(input: CreateProductRequest & { sellerId: string }): Promise<Product> {
    const product = await this.prisma.product.create({
      data: { ...input, imageUrl: input.imageUrl ?? null },
    });
    return toProduct(product);
  }

  async update(id: string, input: UpdateProductRequest): Promise<Product> {
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.price === undefined ? {} : { price: input.price }),
        ...(input.stock === undefined ? {} : { stock: input.stock }),
        ...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
      },
    });
    return toProduct(product);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }
}

function toProduct(model: ProductModel): Product {
  return {
    ...model,
    price: model.price.toNumber(),
    currency: "RUB",
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}
