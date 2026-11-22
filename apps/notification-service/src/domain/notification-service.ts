import { AppError, type Logger } from "@marketplace/common";
import type { Notification, NotificationType } from "@marketplace/contracts/notification";

export interface UserSnapshot {
  id: string;
  email: string;
  name: string;
}

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export interface NotificationRepository {
  saveUser(user: UserSnapshot): Promise<void>;
  findUser(id: string): Promise<UserSnapshot | null>;
  list(userId: string): Promise<Notification[]>;
  create(input: NewNotification): Promise<Notification>;
  markRead(id: string, userId: string): Promise<Notification | null>;
  markEmailSent(id: string): Promise<void>;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly mailer: Mailer,
    private readonly logger?: Pick<Logger, "warn">,
  ) {}

  list(userId: string): Promise<Notification[]> {
    return this.repository.list(userId);
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.repository.markRead(id, userId);
    if (!notification) throw new AppError("Notification not found", "NOTIFICATION_NOT_FOUND", 404);
    return notification;
  }

  async registerUser(user: UserSnapshot): Promise<void> {
    await this.repository.saveUser(user);
    await this.deliver({
      userId: user.id,
      type: "WELCOME",
      title: "Добро пожаловать в Marketplace",
      message: `Здравствуйте, ${user.name}! Ваш аккаунт успешно создан.`,
    }, user);
  }

  async confirmOrder(userId: string, orderId: string): Promise<void> {
    await this.deliver({
      userId,
      type: "ORDER_CONFIRMED",
      title: "Заказ подтверждён",
      message: `Заказ ${orderId} подтверждён. Товары успешно зарезервированы.`,
      orderId,
    });
  }

  async cancelOrder(userId: string, orderId: string, reason: string): Promise<void> {
    await this.deliver({
      userId,
      type: "ORDER_CANCELLED",
      title: "Заказ отменён",
      message: `Заказ ${orderId} отменён. Причина: ${reason}`,
      orderId,
    });
  }

  private async deliver(input: NewNotification, knownUser?: UserSnapshot): Promise<void> {
    const notification = await this.repository.create(input);
    const user = knownUser ?? await this.repository.findUser(input.userId);
    if (!user) {
      this.logger?.warn({ userId: input.userId }, "Email recipient is not available");
      return;
    }
    const subject = input.orderId
      ? `Marketplace order ${input.orderId}: ${input.title}`
      : input.title;
    await this.mailer.send({ to: user.email, subject, text: input.message });
    await this.repository.markEmailSent(notification.id);
  }
}
