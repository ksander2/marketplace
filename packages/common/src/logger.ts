import { pino, type Logger } from "pino";

export function createLogger(options: { service: string; level?: string }): Logger {
  return pino({
    name: options.service,
    level: options.level ?? "info",
    base: { service: options.service },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type { Logger };
