import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getDatabaseUrl(): string {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  if (!configuredUrl) {
    throw new Error(
      "DATABASE_URL is missing. Set it in your environment before starting the app."
    );
  }

  // Resolve relative SQLite URLs from the project root, preserving the
  // current local database location. Absolute URLs such as file:/data/app.db
  // are kept unchanged for persistent hosting volumes.
  if (
    configuredUrl.startsWith("file:./") ||
    configuredUrl.startsWith("file:../")
  ) {
    const relativePath = configuredUrl.slice("file:".length);
    const absolutePath = path
      .resolve(process.cwd(), relativePath)
      .replace(/\\/g, "/");

    return `file:${absolutePath}`;
  }

  return configuredUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: getDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
