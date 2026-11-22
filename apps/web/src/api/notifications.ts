import { notificationSchema, type Notification } from "@marketplace/contracts/notification";

async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/notifications${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Не удалось выполнить запрос");
  }
  return response.json() as Promise<T>;
}

export async function listNotifications(accessToken: string): Promise<Notification[]> {
  const result = await request<unknown>("/", accessToken);
  if (!Array.isArray(result)) throw new Error("Некорректный ответ сервиса уведомлений");
  return result.map((notification) => notificationSchema.parse(notification));
}

export async function markNotificationRead(id: string, accessToken: string): Promise<Notification> {
  return notificationSchema.parse(await request<unknown>(`/${id}/read`, accessToken, {
    method: "PATCH",
  }));
}
