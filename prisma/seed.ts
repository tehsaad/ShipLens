/**
 * Loads the section 10 sample data. Safe to re-run.
 *
 * Usage: SEED_DEMO_PASSWORD=... npx prisma db seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PASSWORD_MIN_LENGTH } from "../lib/validation/limits";
import { demoLogins } from "./seed/data";
import { runSeed } from "./seed/run";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const demoPassword = requireEnv("SEED_DEMO_PASSWORD");
  if (demoPassword.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`SEED_DEMO_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }),
  });
  try {
    const counts = await runSeed(prisma, demoPassword);
    console.log("Seed complete. Records created this run:", counts);
    console.log("Demo logins (password from SEED_DEMO_PASSWORD):", demoLogins);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
