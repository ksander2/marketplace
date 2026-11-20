import {
  productSchema,
  type CreateProductRequest,
  type Product,
  type UpdateProductRequest,
} from "@marketplace/contracts/catalog";
import { z } from "zod";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/products${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Не удалось выполнить запрос");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function authorized(accessToken: string, init: RequestInit): RequestInit {
  return {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  };
}

export async function listProducts(sellerId?: string): Promise<Product[]> {
  const query = sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : "";
  return z.array(productSchema).parse(await request<unknown>(`/${query}`));
}

export async function getProduct(id: string): Promise<Product> {
  return productSchema.parse(await request<unknown>(`/${id}`));
}

export async function createProduct(
  input: CreateProductRequest,
  accessToken: string,
): Promise<Product> {
  const result = await request<unknown>(
    "/",
    authorized(accessToken, { method: "POST", body: JSON.stringify(input) }),
  );
  return productSchema.parse(result);
}

export async function updateProduct(
  id: string,
  input: UpdateProductRequest,
  accessToken: string,
): Promise<Product> {
  const result = await request<unknown>(
    `/${id}`,
    authorized(accessToken, { method: "PUT", body: JSON.stringify(input) }),
  );
  return productSchema.parse(result);
}

export async function deleteProduct(id: string, accessToken: string): Promise<void> {
  await request<void>(`/${id}`, authorized(accessToken, { method: "DELETE" }));
}
