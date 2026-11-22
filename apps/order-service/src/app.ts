import express, { type ErrorRequestHandler, type Express } from "express";
import { AppError, type Logger } from "@marketplace/common";
import { ZodError } from "zod";
import { createOrderRoutes } from "./api/order-routes.js";
import type { OrderService } from "./domain/order-service.js";

interface AppOptions {
  orders: OrderService;
  logger: Logger;
  isReady: () => Promise<boolean>;
}

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/health/live", (_request, response) => {
    response.json({ status: "ok", service: "order-service" });
  });
  app.get("/health/ready", async (_request, response) => {
    const ready = await options.isReady();
    response.status(ready ? 200 : 503).json({ status: ready ? "ok" : "unavailable" });
  });

  app.use("/orders", createOrderRoutes(options.orders));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid request", issues: error.issues },
      });
      return;
    }

    options.logger.error({ err: error }, "Unhandled request error");
    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  };
  app.use(errorHandler);

  return app;
}
