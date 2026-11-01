import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * A rounded call-to-action with a trailing icon badge (the bold landing style).
 * Built on the shared Button so the admin and e2e buttons stay untouched; the
 * badge is aria-hidden, so the accessible name is just the visible label, and
 * the arrow mirrors in right-to-left via CSS.
 */
export function CtaPill({
  href,
  children,
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <Button asChild size="lg" variant={variant} className="cta-pill">
      <Link href={href}>
        {children}
        <span className="cta-badge" aria-hidden="true">
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>
    </Button>
  );
}
