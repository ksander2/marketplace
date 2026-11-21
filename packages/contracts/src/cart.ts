import { z } from "zod";
import { productSchema } from "./catalog.js";

export const addCartItemRequestSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive().max(1_000_000),
});

export const updateCartItemRequestSchema = z.object({
  quantity: z.number().int().positive().max(1_000_000),
});

export const cartItemSchema = z.object({
  product: productSchema,
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  total: z.number().nonnegative(),
});

export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>;
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;
