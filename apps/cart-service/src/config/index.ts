import { baseConfigSchema, loadConfig } from "@marketplace/common";
import { z } from "zod";

const configSchema = baseConfigSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3003),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  RABBITMQ_URL: z.url().default("amqp://marketplace:marketplace@localhost:5673"),
});

export const config = loadConfig(configSchema);
