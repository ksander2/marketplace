import {
  orderSchema,
  type CreateOrderRequest,
  type Order,
} from "@marketplace/contracts/order";

async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/orders${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Не удалось выполнить запрос");
  }
  return response.json() as Promise<T>;
}

export async function createOrder(input: CreateOrderRequest, accessToken: string): Promise<Order> {
  return orderSchema.parse(await request<unknown>("/", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function listOrders(accessToken: string): Promise<Order[]> {
  const result = await request<unknown>("/", accessToken);
  if (!Array.isArray(result)) throw new Error("Некорректный ответ сервера заказов");
  return result.map((order) => orderSchema.parse(order));
}

export async function getOrder(id: string, accessToken: string): Promise<Order> {
  return orderSchema.parse(await request<unknown>(`/${id}`, accessToken));
}
