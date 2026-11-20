import { baseConfigSchema, loadConfig } from "@marketplace/common";
import { z } from "zod";

const configSchema = baseConfigSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.url().default("postgresql://auth:auth@localhost:5432/auth"),
  JWT_PRIVATE_JWK: z.string().min(1).default(
    '{"crv":"Ed25519","d":"KIyUqF7SiH6bYStNk0vf7BgmP4tvfiefqcegjVWlZlw","x":"eKwg_e28alRqgirgmFNWkPFQ_etaiXKRv-G627RzK_0","kty":"OKP"}',
  ),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  SEED_SELLER_EMAIL: z.email().optional(),
  SEED_SELLER_PASSWORD: z.string().min(1).optional(),
});

export const config = loadConfig(configSchema);
