import { getServerEnv } from "@/lib/env";

// Refuse to run with missing or invalid secrets (section 8, A02). Exiting makes a
// misconfigured deployment fail visibly instead of answering every request with an error.
try {
  getServerEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid server environment");
  process.exit(1);
}
