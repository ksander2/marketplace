import { randomUUID } from "node:crypto";
import { z } from "zod";

export const eventTypes = [
  "auth.user.registered",
  "catalog.product.created",
  "catalog.product.updated",
  "catalog.product.deleted",
  "catalog.stock.reserved",
  "catalog.stock.rejected",
  "order.order.created",
  "order.order.confirmed",
  "order.order.cancelled",
  "messaging.test.published",
] as const;

export const eventTypeSchema = z.enum(eventTypes);

export const eventEnvelopeSchema = z.object({
  eventId: z.uuid(),
  type: eventTypeSchema,
  occurredAt: z.iso.datetime(),
  correlationId: z.uuid(),
  version: z.number().int().positive(),
  payload: z.unknown(),
});

export type EventType = z.infer<typeof eventTypeSchema>;

export interface EventEnvelope<T = unknown> {
  eventId: string;
  type: EventType;
  occurredAt: string;
  correlationId: string;
  version: number;
  payload: T;
}

export function defineEventSchema<T extends z.ZodType>(type: EventType, payload: T) {
  return eventEnvelopeSchema.extend({
    type: z.literal(type),
    payload,
  });
}

export function createEvent<T>(options: {
  type: EventType;
  payload: T;
  correlationId: string;
  version?: number;
}): EventEnvelope<T> {
  return {
    eventId: randomUUID(),
    type: options.type,
    occurredAt: new Date().toISOString(),
    correlationId: options.correlationId,
    version: options.version ?? 1,
    payload: options.payload,
  };
}

export const testEventSchema = defineEventSchema(
  "messaging.test.published",
  z.object({ message: z.string().min(1) }),
);

export type TestEvent = z.infer<typeof testEventSchema>;
