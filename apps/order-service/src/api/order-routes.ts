import { randomUUID } from "node:crypto";
import { Router } from "express";
import { AppError } from "@marketplace/common";
import { createOrderRequestSchema } from "@marketplace/contracts/order";
import { userRoleSchema } from "@marketplace/contracts/auth";
import { z } from "zod";
import type { OrderService } from "../domain/order-service.js";

export function createOrderRoutes(orders: OrderService): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    response.json(await orders.list(userId(request.header("x-user-id"))));
  });

  router.get("/:id", async (request, response) => {
    const actor = getActor(request.header("x-user-id"), request.header("x-user-roles"));
    response.json(await orders.get(z.uuid().parse(request.params.id), actor.id, actor.roles));
  });

  router.post("/", async (request, response) => {
    const input = createOrderRequestSchema.parse(request.body);
    const order = await orders.create(
      input,
      userId(request.header("x-user-id")),
      correlationId(request.header("x-correlation-id")),
    );
    response.status(202).json(order);
  });

  return router;
}

function getActor(id: string | undefined, rolesHeader: string | undefined): { id: string; roles: string[] } {
  if (!rolesHeader) throw new AppError("Authentication is required", "UNAUTHORIZED", 401);
  return {
    id: userId(id),
    roles: z.array(userRoleSchema).parse(rolesHeader.split(",")),
  };
}

function userId(value: string | undefined): string {
  if (!value) throw new AppError("Authentication is required", "UNAUTHORIZED", 401);
  return z.uuid().parse(value);
}

function correlationId(value: string | undefined): string {
  return value ? z.uuid().parse(value) : randomUUID();
}
