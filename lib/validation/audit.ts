import { z } from "zod";
import { dateOnlySchema } from "@/lib/validation/common";

/** Audit log viewer filters (section 7.2): actor, entity, action and date range. */
export const auditFiltersSchema = z.object({
  actorId: z.uuid().nullable().catch(null),
  entityType: z.string().trim().max(60).nullable().catch(null),
  entityId: z.string().trim().max(100).nullable().catch(null),
  /** Matches anywhere in the action name, so "export" finds every export. */
  action: z.string().trim().max(60).nullable().catch(null),
  from: dateOnlySchema.nullable().catch(null),
  to: dateOnlySchema.nullable().catch(null),
});

export type AuditFilters = z.infer<typeof auditFiltersSchema>;
