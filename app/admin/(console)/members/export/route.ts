import type { NextRequest } from "next/server";
import { exportResponse } from "@/lib/route-handler";
import { exportMembers } from "@/lib/services/exports";
import { filtersFrom } from "@/lib/validation/common";
import { memberFiltersSchema } from "@/lib/validation/members";

/** CSV of the members matching the list's search and filters (section 7.3). */
export function GET(request: NextRequest): Promise<Response> {
  const filters = filtersFrom(memberFiltersSchema, request.nextUrl.searchParams);
  return exportResponse((ctx) => exportMembers(ctx, filters));
}
