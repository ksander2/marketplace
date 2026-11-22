import { notificationTypeSchema, type Notification } from "@marketplace/contracts/notification";
import type { NewNotification, NotificationRepository, UserSnapshot } from "../domain/notification-service.js";
import type { PrismaClient } from "./prisma.js";

interface NotificationModel {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  orderId: string | null;
  readAt: Date | null;
  emailSentAt: Date | null;
  createdAt: Date;
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveUser(user: UserSnapshot): Promise<void> {
    await this.prisma.userSnapshot.upsert({
      where: { id: user.id },
      create: user,
      update: { email: user.email, name: user.name },
    });
  }

  async findUser(id: string): Promise<UserSnapshot | null> {
    return this.prisma.userSnapshot.findUnique({ where: { id } });
  }

  async list(userId: string): Promise<Notification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return notifications.map(toNotification);
  }

  async create(input: NewNotification): Promise<Notification> {
    const notification = await this.prisma.notification.create({ data: input });
    return toNotification(notification);
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) return null;
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    return notification ? toNotification(notification) : null;
  }

  async markEmailSent(id: string): Promise<void> {
    await this.prisma.notification.update({ where: { id }, data: { emailSentAt: new Date() } });
  }
}

function toNotification(model: NotificationModel): Notification {
  return {
    id: model.id,
    userId: model.userId,
    type: notificationTypeSchema.parse(model.type),
    title: model.title,
    message: model.message,
    orderId: model.orderId,
    readAt: model.readAt?.toISOString() ?? null,
    emailSentAt: model.emailSentAt?.toISOString() ?? null,
    createdAt: model.createdAt.toISOString(),
  };
}
