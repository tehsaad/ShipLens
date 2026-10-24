import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { serviceContext } from "@/lib/server-action";
import type { ExportFile } from "@/lib/services/exports";
import type { ServiceContext } from "@/lib/services/shared";

function text(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * A GET route handler that serves a file export. Route handlers answer with a status code
 * rather than an admin page: 401 without a session, 403 until the first-login password
 * change is done (decision 5), and the status of any AppError the service raises (403 for a
 * role without the permission, 404 for another branch's record, 422 for a refused export).
 */
export async function exportResponse(
  work: (ctx: ServiceContext) => Promise<ExportFile>,
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return text(401, "Please sign in.");
  if (user.mustChangePassword) return text(403, "Change your password before exporting.");
  try {
    const file = await work(await serviceContext(user));
    return new Response(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) return text(error.status, error.message);
    throw error;
  }
}
