import { generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { importJWK, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticate } from "./authenticate.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicJwk = publicKey.export({ format: "jwk" });
const privateJwk = privateKey.export({ format: "jwk" });

describe("authenticate", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const app = express();
    app.get(
      "/protected",
      authenticate(await importJWK(publicJwk, "EdDSA")),
      (request, response) => {
        response.json({
          userId: request.header("x-user-id"),
          roles: request.header("x-user-roles"),
        });
      },
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("rejects a request without a token and ignores spoofed identity headers", async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { "x-user-id": "spoofed", "x-user-roles": "admin" },
    });

    expect(response.status).toBe(401);
  });

  it("accepts a valid token and forwards trusted identity headers", async () => {
    const key = await importJWK(privateJwk, "EdDSA");
    const token = await new SignJWT({ roles: ["buyer"] })
      .setProtectedHeader({ alg: "EdDSA" })
      .setSubject("018f3f2e-7d2f-7d5f-b1a4-5f0e8c6a2b10")
      .setIssuer("marketplace-auth")
      .setAudience("marketplace-api")
      .setExpirationTime("15m")
      .sign(key);

    const response = await fetch(`${baseUrl}/protected`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: "018f3f2e-7d2f-7d5f-b1a4-5f0e8c6a2b10",
      roles: "buyer",
    });
  });
});
