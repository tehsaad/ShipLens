import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

// Fail fast when the database is unreachable instead of waiting on pg's
// default, which never times out.
const CONNECTION_TIMEOUT_MS = 3_000;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const env = getServerEnv();
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
  return new PrismaClient({
    adapter,
    // Production errors reach the caller, which logs a code only (section 8, A09); Prisma's
    // own error log would repeat database messages in the server log.
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["warn"],
  });
}

/**
 * Returns the shared Prisma client. One instance is reused for the whole
 * process (and across hot reloads in development), so requests never open or
 * close their own connection pool.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}
