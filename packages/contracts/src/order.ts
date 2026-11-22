import { z } from "zod";
import { defineEventSchema } from "./events.js";

export const orderStatusSchema = z.enum(["PENDING", "CONFIRMED", "CANCELLED"]);

export const orderItemSchema = z.object({
  productId: z.uuid(),
  name: z.string(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
});

export const orderSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  status: orderStatusSchema,
  items: z.array(orderItemSchema),
  total: z.number().nonnegative(),
  cancelReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createOrderRequestSchema = z.object({
  items: z.array(z.object({
    productId: z.uuid(),
    quantity: z.number().int().positive().max(1_000_000),
  })).min(1).max(100),
});

export const stockReservationItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().positive(),
});

export const orderCreatedEventSchema = defineEventSchema("order.order.created", z.object({
  orderId: z.uuid(),
  userId: z.uuid(),
  items: z.array(stockReservationItemSchema).min(1),
}));

export const stockReservedEventSchema = defineEventSchema("catalog.stock.reserved", z.object({
  orderId: z.uuid(),
  items: z.array(stockReservationItemSchema).min(1),
}));

export const stockRejectedEventSchema = defineEventSchema("catalog.stock.rejected", z.object({
  orderId: z.uuid(),
  reason: z.string().min(1),
}));

export const orderConfirmedEventSchema = defineEventSchema("order.order.confirmed", z.object({
  orderId: z.uuid(),
  userId: z.uuid(),
}));

export const orderCancelledEventSchema = defineEventSchema("order.order.cancelled", z.object({
  orderId: z.uuid(),
  userId: z.uuid(),
  reason: z.string().min(1),
}));

export const orderEventSchema = z.union([
  orderCreatedEventSchema,
  orderConfirmedEventSchema,
  orderCancelledEventSchema,
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type Order = z.infer<typeof orderSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type StockReservationItem = z.infer<typeof stockReservationItemSchema>;
export type OrderEvent = z.infer<typeof orderEventSchema>;
