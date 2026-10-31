import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getResultImage } from "@/lib/services/results";

/**
 * Serves a result's image, same-origin (the CSP forbids external image hosts). A published
 * result's image is public and cached immutably; a draft's image is served only to staff who
 * may read that result, and to everyone else it simply does not exist (404), so a draft can't
 * be discovered by guessing URLs.
 */

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const image = await getResultImage(getPrisma(), id);
  if (!image) return notFound();

  const published = image.status === "PUBLISHED";
  if (!published) {
    const user = await getSessionUser();
    const actor = user ? { id: user.id, role: user.role, branchId: user.branchId } : null;
    if (!actor || !can(actor, "result.read", { branchId: image.branchId })) return notFound();
  }

  const body = new Uint8Array(image.data);
  const headers = new Headers({
    "Content-Type": image.contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(body.byteLength),
    "Content-Disposition": "inline",
  });
  if (published) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (image.imageUpdatedAt) headers.set("ETag", `"${image.imageUpdatedAt.getTime()}"`);
  } else {
    headers.set("Cache-Control", "private, no-store");
  }
  return new Response(body, { status: 200, headers });
}
