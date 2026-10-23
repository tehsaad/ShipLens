import { Badge } from "@/components/admin/page";
import type { MemberStatus } from "@/lib/generated/prisma/enums";
import { MEMBER_STATUS_LABELS } from "@/lib/labels";

const TONES = { ACTIVE: "good", INACTIVE: "neutral", ON_LEAVE: "warn" } as const;

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return <Badge tone={TONES[status]}>{MEMBER_STATUS_LABELS[status]}</Badge>;
}
