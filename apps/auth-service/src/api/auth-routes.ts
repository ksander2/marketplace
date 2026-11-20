import { Router } from "express";
import {
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from "@marketplace/contracts/auth";
import { AppError } from "@marketplace/common";
import type { AuthService } from "../domain/auth-service.js";

export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();

  router.post("/register", async (request, response) => {
    const input = registerRequestSchema.parse(request.body);
    response.status(201).json(await authService.register(input));
  });

  router.post("/login", async (request, response) => {
    const input = loginRequestSchema.parse(request.body);
    response.json(await authService.login(input));
  });

  router.post("/refresh", async (request, response) => {
    const input = refreshRequestSchema.parse(request.body);
    response.json(await authService.refresh(input.refreshToken));
  });

  router.post("/logout", async (request, response) => {
    const input = refreshRequestSchema.parse(request.body);
    await authService.logout(input.refreshToken);
    response.status(204).send();
  });

  router.get("/me", async (request, response) => {
    const userId = request.header("x-user-id");
    if (!userId) throw new AppError("User identity is missing", "UNAUTHORIZED", 401);
    response.json(await authService.me(userId));
  });

  return router;
}
