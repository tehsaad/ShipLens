import { Badge } from "@/components/admin/page";
import type { ReportStatus } from "@/lib/generated/prisma/enums";
import { REPORT_STATUS_LABELS } from "@/lib/labels";

const TONES = { DRAFT: "neutral", SUBMITTED: "warn", RETURNED: "bad", APPROVED: "good" } as const;

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <Badge tone={TONES[status]}>{REPORT_STATUS_LABELS[status]}</Badge>;
}
