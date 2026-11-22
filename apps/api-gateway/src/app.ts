import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { importJWK } from "jose";
import type { Logger } from "@marketplace/common";
import { RateLimiterRes } from "rate-limiter-flexible";
import { authenticate } from "./api/authenticate.js";

interface RateLimiter {
  consume(key: string): Promise<unknown>;
}

interface AppOptions {
  authServiceUrl: string;
  catalogServiceUrl: string;
  cartServiceUrl: string;
  orderServiceUrl: string;
  corsOrigins: string[];
  publicKey: Awaited<ReturnType<typeof importJWK>>;
  rateLimiter: RateLimiter;
  isReady: () => boolean;
  logger: Logger;
}

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: options.corsOrigins }));
  app.use((request, _response, next) => {
    delete request.headers["x-user-id"];
    delete request.headers["x-user-roles"];
    next();
  });

  app.get("/health/live", (_request, response) => {
    response.json({ status: "ok", service: "api-gateway" });
  });
  app.get("/health/ready", (_request, response) => {
    const ready = options.isReady();
    response.status(ready ? 200 : 503).json({ status: ready ? "ok" : "unavailable" });
  });

  const limitRequests: RequestHandler = async (request, response, next) => {
    try {
      await options.rateLimiter.consume(request.ip ?? "unknown");
      next();
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        response.status(429).json({
          error: { code: "RATE_LIMITED", message: "Too many requests" },
        });
        return;
      }
      options.logger.error({ err: error }, "Rate limiter unavailable");
      response.status(503).json({
        error: { code: "RATE_LIMITER_UNAVAILABLE", message: "Rate limiter is unavailable" },
      });
    }
  };
  app.use("/api", limitRequests);

  app.use("/api/auth/me", authenticate(options.publicKey));
  app.use(
    "/api/auth",
    createProxyMiddleware({
      target: options.authServiceUrl,
      changeOrigin: true,
      pathRewrite: (path) => `/auth${path}`,
      on: {
        error: (error, _request, response) => {
          options.logger.error({ err: error }, "Auth service proxy error");
          if ("writeHead" in response) {
            response.writeHead(502, { "content-type": "application/json" });
            response.end(
              JSON.stringify({
                error: { code: "UPSTREAM_UNAVAILABLE", message: "Auth service is unavailable" },
              }),
            );
          } else {
            response.destroy();
          }
        },
      },
    }),
  );

  const requireAuth = authenticate(options.publicKey);
  app.use("/api/products", (request, response, next) => {
    if (request.method === "GET") {
      next();
      return;
    }
    void requireAuth(request, response, next);
  });
  app.use(
    "/api/products",
    createProxyMiddleware({
      target: options.catalogServiceUrl,
      changeOrigin: true,
      pathRewrite: (path) => `/products${path}`,
      on: {
        error: (error, _request, response) => {
          options.logger.error({ err: error }, "Catalog service proxy error");
          if ("writeHead" in response) {
            response.writeHead(502, { "content-type": "application/json" });
            response.end(
              JSON.stringify({
                error: { code: "UPSTREAM_UNAVAILABLE", message: "Catalog service is unavailable" },
              }),
            );
          } else {
            response.destroy();
          }
        },
      },
    }),
  );

  app.use("/api/cart", requireAuth);
  app.use(
    "/api/cart",
    createProxyMiddleware({
      target: options.cartServiceUrl,
      changeOrigin: true,
      pathRewrite: (path) => `/cart${path}`,
      on: {
        error: (error, _request, response) => {
          options.logger.error({ err: error }, "Cart service proxy error");
          if ("writeHead" in response) {
            response.writeHead(502, { "content-type": "application/json" });
            response.end(
              JSON.stringify({
                error: { code: "UPSTREAM_UNAVAILABLE", message: "Cart service is unavailable" },
              }),
            );
          } else {
            response.destroy();
          }
        },
      },
    }),
  );

  app.use("/api/orders", requireAuth);
  app.use(
    "/api/orders",
    createProxyMiddleware({
      target: options.orderServiceUrl,
      changeOrigin: true,
      pathRewrite: (path) => `/orders${path}`,
      on: {
        error: (error, _request, response) => {
          options.logger.error({ err: error }, "Order service proxy error");
          if ("writeHead" in response) {
            response.writeHead(502, { "content-type": "application/json" });
            response.end(
              JSON.stringify({
                error: { code: "UPSTREAM_UNAVAILABLE", message: "Order service is unavailable" },
              }),
            );
          } else {
            response.destroy();
          }
        },
      },
    }),
  );

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  return app;
}
