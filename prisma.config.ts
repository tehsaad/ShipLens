import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations run as the database owner. DATABASE_MIGRATION_URL is optional; without it,
    // DATABASE_URL is used (single-role setups such as local development).
    url: process.env["DATABASE_MIGRATION_URL"] ?? process.env["DATABASE_URL"],
  },
});
