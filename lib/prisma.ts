import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const dbPath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: `file:${dbPath}` });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;