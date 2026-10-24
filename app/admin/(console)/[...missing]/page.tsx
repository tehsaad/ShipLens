import { notFound } from "next/navigation";

/**
 * Unknown /admin URLs render the admin "not found" page on each request instead of the
 * prerendered global one: admin responses carry a per-request nonce policy (proxy.ts), and a
 * prerendered page's scripts have no nonce, so they would be blocked.
 */
export default function MissingAdminPage(): never {
  notFound();
}
