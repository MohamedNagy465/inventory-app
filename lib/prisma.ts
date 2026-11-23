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

  // Prisma resolves relative SQLite URLs from the directory containing
  // prisma/schema.prisma. Keep the runtime client consistent with that rule.
  // For example, file:./dev.db must point to <project>/prisma/dev.db.
  if (configuredUrl.startsWith("file:")) {
    const filePart = configuredUrl.slice("file:".length);
    const queryIndex = filePart.indexOf("?");
    const configuredPath =
      queryIndex >= 0 ? filePart.slice(0, queryIndex) : filePart;
    const query = queryIndex >= 0 ? filePart.slice(queryIndex) : "";

    // Absolute paths (such as Railway's file:/data/inventory.db) are
    // already explicit and must not be resolved relative to the project.
    if (!path.isAbsolute(configuredPath)) {
      const absolutePath = path
        .join(process.cwd(), "prisma", configuredPath)
        .replace(/\\/g, "/");

      return `file:${absolutePath}${query}`;
    }
  }

  return configuredUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: getDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
