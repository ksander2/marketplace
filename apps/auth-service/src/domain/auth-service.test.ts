import { generateKeyPairSync, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { importJWK, jwtVerify } from "jose";
import type { RegisterRequest } from "@marketplace/contracts/auth";
import {
  AuthService,
  type AuthRepository,
  type NewRefreshToken,
  type RefreshTokenRecord,
  type UserRecord,
} from "./auth-service.js";
import { TokenService } from "./token-service.js";

interface StoredToken extends RefreshTokenRecord {
  tokenHash: string;
}

class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, UserRecord>();
  readonly tokens = new Map<string, StoredToken>();

  findUserByEmail(email: string): Promise<UserRecord | null> {
    return Promise.resolve([...this.users.values()].find((user) => user.email === email) ?? null);
  }

  findUserById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  createUser(input: RegisterRequest & { passwordHash: string }): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      roles: ["buyer"],
    };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  createRefreshToken(userId: string, token: NewRefreshToken): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return Promise.reject(new Error("User not found"));
    this.tokens.set(token.tokenHash, {
      id: randomUUID(),
      userId,
      user,
      ...token,
      revokedAt: null,
    });
    return Promise.resolve();
  }

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return Promise.resolve(this.tokens.get(tokenHash) ?? null);
  }

  revokeRefreshToken(id: string): Promise<void> {
    const token = [...this.tokens.values()].find((item) => item.id === id);
    if (token) token.revokedAt = new Date();
    return Promise.resolve();
  }

  revokeAllRefreshTokens(userId: string): Promise<void> {
    for (const token of this.tokens.values()) {
      if (token.userId === userId) token.revokedAt = new Date();
    }
    return Promise.resolve();
  }

  rotateRefreshToken(id: string, token: NewRefreshToken): Promise<boolean> {
    const previous = [...this.tokens.values()].find((item) => item.id === id);
    if (!previous || previous.revokedAt || previous.expiresAt <= new Date()) {
      return Promise.resolve(false);
    }
    previous.revokedAt = new Date();
    this.tokens.set(token.tokenHash, {
      id: randomUUID(),
      userId: previous.userId,
      user: previous.user,
      ...token,
      revokedAt: null,
    });
    return Promise.resolve(true);
  }
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicJwk = publicKey.export({ format: "jwk" });
const privateJwk = privateKey.export({ format: "jwk" });
const registration: RegisterRequest = {
  email: "Buyer@Example.com",
  name: "Test Buyer",
  password: "very-secure-password",
};

describe("AuthService", () => {
  let repository: InMemoryAuthRepository;
  let service: AuthService;

  beforeEach(() => {
    repository = new InMemoryAuthRepository();
    service = new AuthService(
      repository,
      new TokenService({
        privateJwk: JSON.stringify(privateJwk),
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 3600,
      }),
    );
  });

  it("registers a buyer and signs a verifiable access token", async () => {
    const result = await service.register(registration);
    const key = await importJWK(publicJwk, "EdDSA");
    const { payload } = await jwtVerify(result.accessToken, key, {
      issuer: "marketplace-auth",
      audience: "marketplace-api",
    });

    expect(result.user.email).toBe("buyer@example.com");
    expect(result.user.roles).toEqual(["buyer"]);
    expect(payload.sub).toBe(result.user.id);
    expect(payload.roles).toEqual(["buyer"]);
    expect(repository.users.get(result.user.id)?.passwordHash).not.toBe(registration.password);
  });

  it("accepts valid credentials and rejects invalid ones", async () => {
    await service.register(registration);

    await expect(service.login({ email: registration.email, password: "wrong" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(
      service.login({ email: registration.email, password: registration.password }),
    ).resolves.toMatchObject({ user: { email: "buyer@example.com" } });
  });

  it("rotates refresh tokens and revokes the session after reuse", async () => {
    const initial = await service.register(registration);
    const rotated = await service.refresh(initial.refreshToken);

    expect(rotated.refreshToken).not.toBe(initial.refreshToken);
    await expect(service.refresh(initial.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
    await expect(service.refresh(rotated.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("logs out a refresh token", async () => {
    const initial = await service.register(registration);
    await service.logout(initial.refreshToken);

    await expect(service.refresh(initial.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });
});
