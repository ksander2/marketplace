import type { EventEnvelope } from "@marketplace/contracts";
import { userRegisteredEventSchema } from "@marketplace/contracts/auth";
import { orderCancelledEventSchema, orderConfirmedEventSchema } from "@marketplace/contracts/order";
import type { NotificationService } from "../domain/notification-service.js";

export class NotificationEventHandler {
  constructor(private readonly notifications: NotificationService) {}

  async handle(event: EventEnvelope): Promise<void> {
    if (event.type === "auth.user.registered") {
      const { userId, email, name } = userRegisteredEventSchema.parse(event).payload;
      await this.notifications.registerUser({ id: userId, email, name });
      return;
    }
    if (event.type === "order.order.confirmed") {
      const { userId, orderId } = orderConfirmedEventSchema.parse(event).payload;
      await this.notifications.confirmOrder(userId, orderId);
      return;
    }
    if (event.type === "order.order.cancelled") {
      const { userId, orderId, reason } = orderCancelledEventSchema.parse(event).payload;
      await this.notifications.cancelOrder(userId, orderId, reason);
    }
  }
}
