import { baseConfigSchema, loadConfig } from "@marketplace/common";
import { z } from "zod";

const configSchema = baseConfigSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  RABBITMQ_URL: z.url().default("amqp://localhost:5672"),
  AUTH_SERVICE_URL: z.url().default("http://localhost:3001"),
  CATALOG_SERVICE_URL: z.url().default("http://localhost:3002"),
  CART_SERVICE_URL: z.url().default("http://localhost:3003"),
  ORDER_SERVICE_URL: z.url().default("http://localhost:3004"),
  JWT_PUBLIC_JWK: z.string().min(1).default(
    '{"crv":"Ed25519","x":"eKwg_e28alRqgirgmFNWkPFQ_etaiXKRv-G627RzK_0","kty":"OKP"}',
  ),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://localhost:8080")
    .transform((value) => value.split(",").map((origin) => origin.trim())),
  RATE_LIMIT_POINTS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_DURATION_SECONDS: z.coerce.number().int().positive().default(60),
});

export const config = loadConfig(configSchema);
