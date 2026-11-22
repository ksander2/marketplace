import { describe, expect, it } from "vitest";
import { openApiDocument } from "./openapi.js";

function collectRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectRefs);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "$ref" && typeof child === "string" ? [child] : collectRefs(child));
}

function resolveRef(document: unknown, ref: string): unknown {
  return ref.slice(2).split("/").reduce<unknown>((value, part) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part.replaceAll("~1", "/").replaceAll("~0", "~")];
  }, document);
}

describe("OpenAPI document", () => {
  it("covers every external API Gateway route", () => {
    expect(Object.keys(openApiDocument.paths).sort()).toEqual([
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/me",
      "/api/auth/refresh",
      "/api/auth/register",
      "/api/cart",
      "/api/cart/items",
      "/api/cart/items/{productId}",
      "/api/events/orders",
      "/api/notifications",
      "/api/notifications/{id}/read",
      "/api/orders",
      "/api/orders/{id}",
      "/api/products",
      "/api/products/{id}",
      "/health/live",
      "/health/ready",
    ].sort());
    expect(Object.values(openApiDocument.paths).flatMap((item) => Object.values(item))).toHaveLength(23);
  });

  it("uses Bearer JWT for protected routes and keeps login public", () => {
    expect(openApiDocument.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
    expect(openApiDocument.paths["/api/cart"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(openApiDocument.paths["/api/products"].get).not.toHaveProperty("security");
    expect(openApiDocument.paths["/api/auth/login"].post).not.toHaveProperty("security");
  });

  it("derives DTO constraints from the shared contracts", () => {
    expect(openApiDocument.components.schemas.RegisterRequest).toMatchObject({
      properties: {
        password: { minLength: 12, maxLength: 128 },
        name: { minLength: 2, maxLength: 80 },
      },
    });
    expect(openApiDocument.components.schemas.CreateProductRequest).toMatchObject({
      required: ["name", "description", "category", "price", "stock"],
      properties: { stock: { type: "integer", minimum: 0 } },
    });
    expect(openApiDocument.components.schemas.CreateOrderRequest).toMatchObject({
      properties: { items: { minItems: 1, maxItems: 100 } },
    });
  });

  it("contains only resolvable local references", () => {
    const refs = collectRefs(openApiDocument);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref.startsWith("#/"), ref).toBe(true);
      expect(resolveRef(openApiDocument, ref), ref).toBeDefined();
    }
  });
});
