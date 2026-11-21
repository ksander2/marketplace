import { Router } from "express";
import { AppError } from "@marketplace/common";
import {
  addCartItemRequestSchema,
  updateCartItemRequestSchema,
} from "@marketplace/contracts/cart";
import { z } from "zod";
import type { CartService } from "../domain/cart-service.js";

export function createCartRoutes(cart: CartService): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    response.json(await cart.get(userId(request.header("x-user-id"))));
  });

  router.post("/items", async (request, response) => {
    const input = addCartItemRequestSchema.parse(request.body);
    response.json(await cart.add(userId(request.header("x-user-id")), input));
  });

  router.put("/items/:productId", async (request, response) => {
    const input = updateCartItemRequestSchema.parse(request.body);
    const productId = z.uuid().parse(request.params.productId);
    await cart.set(userId(request.header("x-user-id")), productId, input);
    response.json(await cart.get(userId(request.header("x-user-id"))));
  });

  router.delete("/items/:productId", async (request, response) => {
    await cart.remove(
      userId(request.header("x-user-id")),
      z.uuid().parse(request.params.productId),
    );
    response.status(204).send();
  });

  router.delete("/", async (request, response) => {
    await cart.clear(userId(request.header("x-user-id")));
    response.status(204).send();
  });

  return router;
}

function userId(value: string | undefined): string {
  if (!value) throw new AppError("Authentication is required", "UNAUTHORIZED", 401);
  return z.uuid().parse(value);
}
