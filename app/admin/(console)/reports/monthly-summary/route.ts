import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { exportResponse } from "@/lib/route-handler";
import { exportMonthlySummary } from "@/lib/services/pdf-exports";
import { monthlySummarySchema } from "@/lib/validation/reports";

/** PDF summary of one branch's month (section 7.3): ?branchId=<uuid>&month=YYYY-MM. */
export function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const input = monthlySummarySchema.safeParse({
    branchId: searchParams.get("branchId") || null,
    month: searchParams.get("month") ?? "",
  });
  return exportResponse((ctx) => {
    if (!input.success) throw new AppError("VALIDATION", input.error.issues[0]!.message);
    return exportMonthlySummary(ctx, input.data);
  });
}
