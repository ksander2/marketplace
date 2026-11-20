import { createHash, randomBytes, randomUUID } from "node:crypto";
import { importJWK, SignJWT } from "jose";
import type { AuthUser } from "@marketplace/contracts/auth";

interface TokenServiceOptions {
  privateJwk: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

export interface RefreshTokenData {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export class TokenService {
  private privateKey: Awaited<ReturnType<typeof importJWK>> | null = null;

  constructor(private readonly options: TokenServiceOptions) {}

  async createAccessToken(user: AuthUser): Promise<string> {
    const key = this.privateKey ?? (await importJWK(JSON.parse(this.options.privateJwk), "EdDSA"));
    this.privateKey = key;

    return new SignJWT({ roles: user.roles })
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
      .setSubject(user.id)
      .setIssuer("marketplace-auth")
      .setAudience("marketplace-api")
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${this.options.accessTokenTtlSeconds}s`)
      .sign(key);
  }

  createRefreshToken(): RefreshTokenData {
    const token = randomBytes(32).toString("base64url");
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + this.options.refreshTokenTtlSeconds * 1_000),
    };
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
