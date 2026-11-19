import express, { type Express } from "express";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health/live", (_request, response) => {
    response.json({ status: "ok", service: "api-gateway" });
  });
  app.get("/health/ready", (_request, response) => {
    response.json({ status: "ok", service: "api-gateway" });
  });

  return app;
}
