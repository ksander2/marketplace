import {
  authResponseSchema,
  authUserSchema,
  type AuthResponse,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
} from "@marketplace/contracts/auth";

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Не удалось выполнить запрос");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(input: LoginRequest): Promise<AuthResponse> {
  const result = await request<unknown>("/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return authResponseSchema.parse(result);
}

export async function register(input: RegisterRequest): Promise<AuthResponse> {
  const result = await request<unknown>("/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return authResponseSchema.parse(result);
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  const result = await request<unknown>("/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  return authResponseSchema.parse(result);
}

export async function logout(refreshToken: string): Promise<void> {
  await request<void>("/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export async function me(accessToken: string): Promise<AuthUser> {
  const result = await request<unknown>("/me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return authUserSchema.parse(result);
}
