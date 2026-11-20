import { z } from "zod";
import { defineEventSchema } from "./events.js";

export const createProductRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(80),
  price: z.number().positive().max(9_999_999_999.99),
  stock: z.number().int().min(0).max(2_000_000_000),
  imageUrl: z.url().max(2048).optional(),
});

export const updateProductRequestSchema = createProductRequestSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: "At least one field is required" },
);

export const productSchema = z.object({
  id: z.uuid(),
  sellerId: z.uuid(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number(),
  currency: z.literal("RUB"),
  stock: z.number().int().min(0),
  imageUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const productCreatedEventSchema = defineEventSchema("catalog.product.created", productSchema);
export const productUpdatedEventSchema = defineEventSchema("catalog.product.updated", productSchema);
export const productDeletedEventSchema = defineEventSchema(
  "catalog.product.deleted",
  z.object({ productId: z.uuid() }),
);

export type Product = z.infer<typeof productSchema>;
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;
