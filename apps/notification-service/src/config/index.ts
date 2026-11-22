import { baseConfigSchema, loadConfig } from "@marketplace/common";
import { z } from "zod";

const configSchema = baseConfigSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3005),
  DATABASE_URL: z.url().default("postgresql://notifications:notifications@localhost:5432/notifications"),
  RABBITMQ_URL: z.url().default("amqp://localhost:5672"),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_FROM: z.email().default("marketplace@marketplace.local"),
});

export const config = loadConfig(configSchema);
