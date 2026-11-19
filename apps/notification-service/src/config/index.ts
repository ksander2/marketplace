import { baseConfigSchema, loadConfig } from "@marketplace/common";
import { z } from "zod";

const configSchema = baseConfigSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3005),
  DATABASE_URL: z.url().default("postgresql://notifications:notifications@localhost:5432/notifications"),
});

export const config = loadConfig(configSchema);
