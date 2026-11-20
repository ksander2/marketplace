import type {
  AuthRepository,
  NewRefreshToken,
  RefreshTokenRecord,
  UserRecord,
} from "../domain/auth-service.js";
import { userRoleSchema, type RegisterRequest } from "@marketplace/contracts/auth";
import type { PrismaClient } from "./prisma.js";

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? toUserRecord(user) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toUserRecord(user) : null;
  }

  async createUser(input: RegisterRequest & { passwordHash: string }): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        roles: ["buyer"],
      },
    });
    return toUserRecord(user);
  }

  async createRefreshToken(userId: string, token: NewRefreshToken): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
      },
    });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    return token ? { ...token, user: toUserRecord(token.user) } : null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async rotateRefreshToken(id: string, token: NewRefreshToken): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) return false;

      const previous = await transaction.refreshToken.findUniqueOrThrow({ where: { id } });
      await transaction.refreshToken.create({
        data: {
          userId: previous.userId,
          tokenHash: token.tokenHash,
          expiresAt: token.expiresAt,
        },
      });
      return true;
    });
  }
}

function toUserRecord(user: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  roles: string[];
}): UserRecord {
  return { ...user, roles: userRoleSchema.array().parse(user.roles) };
}
