import type { NextRequest } from "next/server";
import { exportResponse } from "@/lib/route-handler";
import { exportApplications } from "@/lib/services/exports";
import { applicationFiltersSchema } from "@/lib/validation/applications";
import { filtersFrom } from "@/lib/validation/common";

/** CSV of the applications matching the list's filters (section 7.3). */
export function GET(request: NextRequest): Promise<Response> {
  const filters = filtersFrom(applicationFiltersSchema, request.nextUrl.searchParams);
  return exportResponse((ctx) => exportApplications(ctx, filters));
}
