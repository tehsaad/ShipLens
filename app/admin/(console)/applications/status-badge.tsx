import { Badge } from "@/components/admin/page";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { APPLICATION_STATUS_LABELS } from "@/lib/labels";

const TONES = { NEW: "warn", ACCEPTED: "good", DECLINED: "neutral" } as const;

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={TONES[status]}>{APPLICATION_STATUS_LABELS[status]}</Badge>;
}
