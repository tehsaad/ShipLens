import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto grid max-w-md gap-3 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Not allowed</h1>
      <p className="text-muted-foreground">Your role does not have access to this page.</p>
      <p>
        <Link href="/admin" className="text-primary underline">
          Back to admin
        </Link>
      </p>
    </main>
  );
}
