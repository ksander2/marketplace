import { z } from "zod";

export const userRoleSchema = z.enum(["buyer", "seller", "admin"]);

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(2).max(80),
  roles: z.array(userRoleSchema),
});

export const registerRequestSchema = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(2).max(80),
  password: z.string().min(12).max(128),
});

export const loginRequestSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(43).max(512),
});

export const authResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export const userRegisteredEventSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  name: z.string(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
