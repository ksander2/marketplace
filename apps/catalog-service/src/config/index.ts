import { baseConfigSchema, loadConfig } from "@marketplace/common";
import { z } from "zod";

const configSchema = baseConfigSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  DATABASE_URL: z.url().default("postgresql://catalog:catalog@localhost:5432/catalog"),
  RABBITMQ_URL: z.url().default("amqp://marketplace:marketplace@localhost:5673"),
});

export const config = loadConfig(configSchema);
