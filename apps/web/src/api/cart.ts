import {
  cartSchema,
  type AddCartItemRequest,
  type Cart,
  type UpdateCartItemRequest,
} from "@marketplace/contracts/cart";

async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/cart${path}`, {
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
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getCart(accessToken: string): Promise<Cart> {
  return cartSchema.parse(await request<unknown>("/", accessToken));
}

export async function addCartItem(
  input: AddCartItemRequest,
  accessToken: string,
): Promise<Cart> {
  return cartSchema.parse(await request<unknown>("/items", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function setCartItemQuantity(
  productId: string,
  input: UpdateCartItemRequest,
  accessToken: string,
): Promise<Cart> {
  return cartSchema.parse(await request<unknown>(`/items/${productId}`, accessToken, {
    method: "PUT",
    body: JSON.stringify(input),
  }));
}

export async function removeCartItem(productId: string, accessToken: string): Promise<void> {
  await request<void>(`/items/${productId}`, accessToken, { method: "DELETE" });
}

export async function clearCart(accessToken: string): Promise<void> {
  await request<void>("/", accessToken, { method: "DELETE" });
}
