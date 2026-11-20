import { randomUUID } from "node:crypto";
import { authResponseSchema, authUserSchema } from "@marketplace/contracts/auth";

const baseUrl = process.env.API_URL ?? "http://localhost:3000";
const email = `buyer-${randomUUID()}@example.com`;
const password = "very-secure-password";

async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}/api/auth${path}`, init);
}

function expectStatus(response: Response, expected: number): void {
  if (response.status !== expected) {
    throw new Error(`${response.url}: expected ${expected}, received ${response.status}`);
  }
}

const unauthorized = await call("/me");
expectStatus(unauthorized, 401);

const registered = await call("/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, name: "Smoke Buyer", password }),
});
expectStatus(registered, 201);
const registration = authResponseSchema.parse(await registered.json());

const wrongPassword = await call("/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password: "wrong-password" }),
});
expectStatus(wrongPassword, 401);

const loggedIn = await call("/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
expectStatus(loggedIn, 200);
authResponseSchema.parse(await loggedIn.json());

const profile = await call("/me", {
  headers: { authorization: `Bearer ${registration.accessToken}` },
});
expectStatus(profile, 200);
const user = authUserSchema.parse(await profile.json());
if (user.email !== email) throw new Error("Profile email does not match the registered user");

const refreshed = await call("/refresh", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ refreshToken: registration.refreshToken }),
});
expectStatus(refreshed, 200);
const rotation = authResponseSchema.parse(await refreshed.json());
if (rotation.refreshToken === registration.refreshToken) {
  throw new Error("Refresh token was not rotated");
}

const reused = await call("/refresh", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ refreshToken: registration.refreshToken }),
});
expectStatus(reused, 401);

const newLogin = await call("/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const newSession = authResponseSchema.parse(await newLogin.json());
const loggedOut = await call("/logout", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ refreshToken: newSession.refreshToken }),
});
expectStatus(loggedOut, 204);

console.log(`Auth smoke test passed for ${email}: unauthorized, register, login, me, refresh, logout`);
