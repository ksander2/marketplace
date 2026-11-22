import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "WELCOME",
  "ORDER_CONFIRMED",
  "ORDER_CANCELLED",
]);

export const notificationSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  orderId: z.uuid().nullable(),
  readAt: z.iso.datetime().nullable(),
  emailSentAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type Notification = z.infer<typeof notificationSchema>;
