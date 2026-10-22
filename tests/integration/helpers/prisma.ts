import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { getTestDatabaseUrl } from "../test-database";

/** A Prisma client connected to the test database. */
export function createTestPrisma(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: getTestDatabaseUrl() }) });
}
