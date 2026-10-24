import { notFound } from "@/lib/errors";
import { exportResponse } from "@/lib/route-handler";
import { exportReportPdf } from "@/lib/services/pdf-exports";
import { uuidSchema } from "@/lib/validation/common";

/** PDF of an approved weekly report (section 7.3). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const id = uuidSchema.safeParse((await params).id);
  return exportResponse((ctx) => {
    if (!id.success) throw notFound();
    return exportReportPdf(ctx, id.data);
  });
}
