import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Notification } from "@marketplace/contracts/notification";
import {
  NotificationService,
  type Email,
  type NewNotification,
  type NotificationRepository,
  type UserSnapshot,
} from "./notification-service.js";

class InMemoryNotificationRepository implements NotificationRepository {
  readonly users = new Map<string, UserSnapshot>();
  readonly notifications: Notification[] = [];

  saveUser(user: UserSnapshot): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  findUser(id: string): Promise<UserSnapshot | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  list(userId: string): Promise<Notification[]> {
    return Promise.resolve(this.notifications.filter((notification) => notification.userId === userId));
  }

  create(input: NewNotification): Promise<Notification> {
    const notification: Notification = {
      id: randomUUID(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      orderId: input.orderId ?? null,
      readAt: null,
      emailSentAt: null,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(notification);
    return Promise.resolve(notification);
  }

  markRead(id: string, userId: string): Promise<Notification | null> {
    const notification = this.notifications.find((item) => item.id === id && item.userId === userId);
    if (!notification) return Promise.resolve(null);
    notification.readAt = new Date().toISOString();
    return Promise.resolve(notification);
  }

  markEmailSent(id: string): Promise<void> {
    const notification = this.notifications.find((item) => item.id === id);
    if (notification) notification.emailSentAt = new Date().toISOString();
    return Promise.resolve();
  }
}

describe("NotificationService", () => {
  let repository: InMemoryNotificationRepository;
  let emails: Email[];
  let service: NotificationService;

  beforeEach(() => {
    repository = new InMemoryNotificationRepository();
    emails = [];
    service = new NotificationService(repository, {
      send: async (email) => { emails.push(email); },
    });
  });

  it("saves the registered user and sends a welcome notification", async () => {
    const user = { id: randomUUID(), email: "buyer@example.com", name: "Test Buyer" };
    await service.registerUser(user);

    expect(repository.users.get(user.id)).toEqual(user);
    expect(repository.notifications[0]).toMatchObject({
      userId: user.id,
      type: "WELCOME",
    });
    expect(repository.notifications[0]?.message).toContain(user.name);
    expect(repository.notifications[0]?.emailSentAt).not.toBeNull();
    expect(emails[0]).toMatchObject({ to: user.email, subject: "Добро пожаловать в Marketplace" });
  });

  it("creates order notifications with details and cancellation reason", async () => {
    const user = { id: randomUUID(), email: "buyer@example.com", name: "Test Buyer" };
    const confirmedOrderId = randomUUID();
    const cancelledOrderId = randomUUID();
    await service.registerUser(user);
    await service.confirmOrder(user.id, confirmedOrderId);
    await service.cancelOrder(user.id, cancelledOrderId, "Недостаточно товара на складе");

    expect(repository.notifications[1]).toMatchObject({
      type: "ORDER_CONFIRMED",
      orderId: confirmedOrderId,
    });
    expect(repository.notifications[2]).toMatchObject({
      type: "ORDER_CANCELLED",
      orderId: cancelledOrderId,
    });
    expect(repository.notifications[2]?.message).toContain("Недостаточно товара на складе");
    expect(emails.map((email) => email.to)).toEqual([user.email, user.email, user.email]);
  });

  it("keeps an in-app notification when the email recipient is not replicated yet", async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    await service.confirmOrder(userId, orderId);

    expect(repository.notifications).toHaveLength(1);
    expect(repository.notifications[0]?.emailSentAt).toBeNull();
    expect(emails).toHaveLength(0);
  });

  it("marks only the user's own notification as read", async () => {
    const user = { id: randomUUID(), email: "buyer@example.com", name: "Test Buyer" };
    await service.registerUser(user);
    const notification = repository.notifications[0]!;

    await expect(service.markRead(notification.id, randomUUID())).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
    });
    await expect(service.markRead(notification.id, user.id)).resolves.toMatchObject({
      id: notification.id,
      readAt: expect.any(String),
    });
  });
});
