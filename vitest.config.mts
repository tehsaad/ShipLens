import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

const shared = {
  resolve: {
    alias: {
      "@/": root,
      // `server-only` throws outside the React Server Components runtime; tests run in Node.
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
};

export default defineConfig({
  test: {
    // Section 11: at least 60% line coverage on backend code (lib/, server actions, route
    // handlers), measured over the unit and integration projects together. Files no test
    // reaches count at 0%.
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/**/actions.ts", "app/**/route.ts"],
      exclude: ["lib/generated/**", "**/*.d.ts"],
      reporter: ["text-summary", "html"],
      thresholds: { lines: 60 },
    },
    projects: [
      {
        ...shared,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        ...shared,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup-env.ts"],
          // Integration tests share one database.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
