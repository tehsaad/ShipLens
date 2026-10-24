import { exportResponse } from "@/lib/route-handler";
import { exportUnrouted } from "@/lib/services/exports";

/** CSV of every unrouted collection on the actor's dashboard, oldest first (section 7.3). */
export function GET(): Promise<Response> {
  return exportResponse(exportUnrouted);
}
