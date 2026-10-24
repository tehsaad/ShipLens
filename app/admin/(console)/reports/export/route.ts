import type { NextRequest } from "next/server";
import { exportResponse } from "@/lib/route-handler";
import { exportReports } from "@/lib/services/exports";
import { filtersFrom } from "@/lib/validation/common";
import { reportFiltersSchema } from "@/lib/validation/reports";

/** CSV of the weekly reports matching the list's filters (section 7.3). */
export function GET(request: NextRequest): Promise<Response> {
  const filters = filtersFrom(reportFiltersSchema, request.nextUrl.searchParams);
  return exportResponse((ctx) => exportReports(ctx, filters));
}
