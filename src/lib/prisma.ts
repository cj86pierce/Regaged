import { PrismaClient } from "@prisma/client";

// Uses DATABASE_URL from .env (required for DB access)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["error"] });

globalForPrisma.prisma = prisma;
