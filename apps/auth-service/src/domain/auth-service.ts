import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { AppError } from "@marketplace/common";
import { createEvent, type EventEnvelope } from "@marketplace/contracts";
import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from "@marketplace/contracts/auth";
import { TokenService, type RefreshTokenData } from "./token-service.js";

export interface UserRecord extends AuthUser {
  passwordHash: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: UserRecord;
}

export interface NewRefreshToken {
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(input: RegisterRequest & { passwordHash: string }): Promise<UserRecord>;
  createRefreshToken(userId: string, token: NewRefreshToken): Promise<void>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeAllRefreshTokens(userId: string): Promise<void>;
  rotateRefreshToken(id: string, token: NewRefreshToken): Promise<boolean>;
}

export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenService,
    private readonly events: EventPublisher,
  ) {}

  async register(input: RegisterRequest, correlationId: string = randomUUID()): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const existing = await this.repository.findUserByEmail(email);
    if (existing) throw new AppError("Email is already registered", "EMAIL_ALREADY_EXISTS", 409);

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.repository.createUser({ ...input, email, passwordHash });
    const response = await this.createAuthResponse(user);
    await this.events.publish(createEvent({
      type: "auth.user.registered",
      correlationId,
      payload: { userId: user.id, email: user.email, name: user.name },
    }));
    return response;
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await this.repository.findUserByEmail(input.email.toLowerCase());
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError("Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    return this.createAuthResponse(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const stored = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!stored) throw this.invalidRefreshToken();
    if (stored.revokedAt) {
      await this.repository.revokeAllRefreshTokens(stored.userId);
      throw this.invalidRefreshToken();
    }
    if (stored.expiresAt <= new Date()) throw this.invalidRefreshToken();

    const nextToken = this.tokens.createRefreshToken();
    const rotated = await this.repository.rotateRefreshToken(stored.id, nextToken);
    if (!rotated) throw this.invalidRefreshToken();

    return {
      user: this.toPublicUser(stored.user),
      accessToken: await this.tokens.createAccessToken(stored.user),
      refreshToken: nextToken.token,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.repository.findRefreshTokenByHash(
      this.tokens.hashRefreshToken(refreshToken),
    );
    if (stored && !stored.revokedAt) await this.repository.revokeRefreshToken(stored.id);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AppError("User not found", "USER_NOT_FOUND", 404);
    return this.toPublicUser(user);
  }

  private async createAuthResponse(user: UserRecord): Promise<AuthResponse> {
    const refreshToken: RefreshTokenData = this.tokens.createRefreshToken();
    await this.repository.createRefreshToken(user.id, refreshToken);

    return {
      user: this.toPublicUser(user),
      accessToken: await this.tokens.createAccessToken(user),
      refreshToken: refreshToken.token,
    };
  }

  private toPublicUser(user: UserRecord): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    };
  }

  private invalidRefreshToken(): AppError {
    return new AppError("Refresh token is invalid or expired", "INVALID_REFRESH_TOKEN", 401);
  }
}
