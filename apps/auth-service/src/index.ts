import { createLogger } from "@marketplace/common";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { AuthService } from "./domain/auth-service.js";
import { TokenService } from "./domain/token-service.js";
import { PrismaAuthRepository } from "./infra/prisma-auth-repository.js";
import { createPrismaClient } from "./infra/prisma.js";
import { seedSeller } from "./infra/seed-seller.js";

const logger = createLogger({ service: "auth-service", level: config.LOG_LEVEL });
const prisma = createPrismaClient();
await prisma.$connect();
if (config.SEED_SELLER_EMAIL && config.SEED_SELLER_PASSWORD) {
  await seedSeller(prisma, {
    email: config.SEED_SELLER_EMAIL,
    password: config.SEED_SELLER_PASSWORD,
  });
}

const tokens = new TokenService({
  privateJwk: config.JWT_PRIVATE_JWK,
  accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlSeconds: config.REFRESH_TOKEN_TTL_SECONDS,
});
const authService = new AuthService(new PrismaAuthRepository(prisma), tokens);
const server = createApp({
  authService,
  logger,
  isReady: async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },
}).listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "Auth service is listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down");
  server.close((error) => {
    void prisma.$disconnect().then(() => {
      if (error) {
        logger.error({ err: error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      }
    });
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
