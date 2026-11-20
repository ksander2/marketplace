import { randomUUID } from "node:crypto";
import { Router } from "express";
import { AppError } from "@marketplace/common";
import {
  createProductRequestSchema,
  updateProductRequestSchema,
} from "@marketplace/contracts/catalog";
import { userRoleSchema } from "@marketplace/contracts/auth";
import { z } from "zod";
import type { Actor, CatalogService } from "../domain/catalog-service.js";

export function createCatalogRoutes(catalog: CatalogService): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    const sellerId = request.query.sellerId
      ? z.uuid().parse(request.query.sellerId)
      : undefined;
    response.json(await catalog.list(sellerId));
  });

  router.get("/:id", async (request, response) => {
    response.json(await catalog.get(z.uuid().parse(request.params.id)));
  });

  router.post("/", async (request, response) => {
    const actor = getActor(request.header("x-user-id"), request.header("x-user-roles"));
    const input = createProductRequestSchema.parse(request.body);
    response.status(201).json(await catalog.create(input, actor, correlationId(request.header("x-correlation-id"))));
  });

  router.put("/:id", async (request, response) => {
    const actor = getActor(request.header("x-user-id"), request.header("x-user-roles"));
    const id = z.uuid().parse(request.params.id);
    const input = updateProductRequestSchema.parse(request.body);
    response.json(await catalog.update(id, input, actor, correlationId(request.header("x-correlation-id"))));
  });

  router.delete("/:id", async (request, response) => {
    const actor = getActor(request.header("x-user-id"), request.header("x-user-roles"));
    await catalog.delete(
      z.uuid().parse(request.params.id),
      actor,
      correlationId(request.header("x-correlation-id")),
    );
    response.status(204).send();
  });

  return router;
}

function getActor(userId: string | undefined, rolesHeader: string | undefined): Actor {
  if (!userId || !rolesHeader) throw new AppError("Authentication is required", "UNAUTHORIZED", 401);
  return {
    id: z.uuid().parse(userId),
    roles: z.array(userRoleSchema).parse(rolesHeader.split(",")),
  };
}

function correlationId(value: string | undefined): string {
  return value ? z.uuid().parse(value) : randomUUID();
}
