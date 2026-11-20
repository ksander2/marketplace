import type { RequestHandler } from "express";
import { importJWK, jwtVerify } from "jose";
import { userRoleSchema } from "@marketplace/contracts/auth";
import { z } from "zod";

const rolesSchema = z.array(userRoleSchema).min(1);

export function authenticate(
  publicKey: Awaited<ReturnType<typeof importJWK>>,
): RequestHandler {
  return async (request, response, next) => {
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      response.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Bearer token is required" },
      });
      return;
    }

    try {
      const token = authorization.slice("Bearer ".length).trim();
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: "marketplace-auth",
        audience: "marketplace-api",
        algorithms: ["EdDSA"],
      });
      if (!payload.sub) throw new Error("JWT subject is missing");
      const roles = rolesSchema.parse(payload.roles);

      request.headers["x-user-id"] = payload.sub;
      request.headers["x-user-roles"] = roles.join(",");
      next();
    } catch {
      response.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Access token is invalid or expired" },
      });
    }
  };
}
