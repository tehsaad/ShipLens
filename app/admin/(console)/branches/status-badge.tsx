import { Badge } from "@/components/admin/page";
import type { BranchStatus } from "@/lib/generated/prisma/enums";
import { BRANCH_STATUS_LABELS } from "@/lib/labels";

const TONES = { FORMING: "warn", ACTIVE: "good", PAUSED: "neutral", CLOSED: "bad" } as const;

export function BranchStatusBadge({ status }: { status: BranchStatus }) {
  return <Badge tone={TONES[status]}>{BRANCH_STATUS_LABELS[status]}</Badge>;
}
