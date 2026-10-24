import { getPrisma } from "@/lib/db";
import { logEvent } from "@/lib/log";

// Always run on request, on the Node.js runtime: the result must reflect the
// database right now, and the build must never try to connect.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATABASE_CHECK_TIMEOUT_MS = 3_000;

type HealthBody = {
  status: "ok" | "error";
  database: "up" | "down";
};

function respond(body: HealthBody, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function checkDatabase(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Database check timed out")),
      DATABASE_CHECK_TIMEOUT_MS,
    );
  });
  try {
    // Constant query with no user input; used only to prove connectivity.
    await Promise.race([getPrisma().$queryRaw`SELECT 1`, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(): Promise<Response> {
  try {
    await checkDatabase();
    return respond({ status: "ok", database: "up" }, 200);
  } catch (error) {
    // Log only a non-sensitive code; never the message, which can contain
    // connection details. The client gets a generic body.
    const code =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "UNKNOWN";
    logEvent("error", "health.databaseUnreachable", { code });
    return respond({ status: "error", database: "down" }, 503);
  }
}
