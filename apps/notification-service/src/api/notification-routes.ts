import { Router } from "express";
import { AppError } from "@marketplace/common";
import { z } from "zod";
import type { NotificationService } from "../domain/notification-service.js";

export function createNotificationRoutes(notifications: NotificationService): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    response.json(await notifications.list(userId(request.header("x-user-id"))));
  });

  router.patch("/:id/read", async (request, response) => {
    response.json(await notifications.markRead(
      z.uuid().parse(request.params.id),
      userId(request.header("x-user-id")),
    ));
  });

  return router;
}

function userId(value: string | undefined): string {
  if (!value) throw new AppError("Authentication is required", "UNAUTHORIZED", 401);
  return z.uuid().parse(value);
}
