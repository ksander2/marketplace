import bcrypt from "bcryptjs";
import type { PrismaClient } from "./prisma.js";

export async function seedSeller(
  prisma: PrismaClient,
  input: { email: string; password: string },
): Promise<void> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  await prisma.user.create({
    data: {
      email,
      name: "Demo Seller",
      passwordHash: await bcrypt.hash(input.password, 12),
      roles: ["seller"],
    },
  });
}
