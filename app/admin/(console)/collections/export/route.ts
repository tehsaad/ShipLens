import type { NextRequest } from "next/server";
import { exportResponse } from "@/lib/route-handler";
import { exportCollections } from "@/lib/services/exports";
import { collectionFiltersSchema } from "@/lib/validation/collections";
import { filtersFrom } from "@/lib/validation/common";

/** CSV of the collections matching the list's filters (section 7.3). */
export function GET(request: NextRequest): Promise<Response> {
  const filters = filtersFrom(collectionFiltersSchema, request.nextUrl.searchParams);
  return exportResponse((ctx) => exportCollections(ctx, filters));
}
