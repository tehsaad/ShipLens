import type { Metadata } from "next";
import { getPrisma } from "@/lib/db";
import { listApplicationBranches } from "@/lib/services/applications";
import { ApplicationForm } from "./application-form";

export const metadata: Metadata = { title: "Get involved" };

// Rendered per request: the image is built without a database. Phase 4 moves the public
// pages to cached rendering with revalidation (section 9).
export const dynamic = "force-dynamic";

export default async function GetInvolvedPage() {
  const branches = await listApplicationBranches(getPrisma());

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold">Get involved</h1>
        <p className="text-muted-foreground">
          Tell us about yourself and choose the branch closest to you. Our HR team reviews every
          application and contacts you about the next steps. Volunteers do not get a login.
        </p>
      </header>
      {branches.length === 0 ? (
        <p>No branch is taking volunteers right now. Please check again soon.</p>
      ) : (
        <ApplicationForm branches={branches} />
      )}
    </main>
  );
}
