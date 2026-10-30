import type { Metadata } from "next";
import Link from "next/link";
import { instrumentSans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = { title: "Page not found · Hamqadam Volunteers" };

/** Any URL that matches no route at all (the app has two root layouts, so no shared 404). */
export default function GlobalNotFound() {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body className="font-sans">
        <main className="mx-auto grid max-w-md gap-3 px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p>The page you are looking for does not exist or has moved.</p>
          <p>
            <Link href="/en" className="underline">
              Go to the home page
            </Link>{" "}
            ·{" "}
            <Link href="/ur" lang="ur" className="underline">
              صفحۂ اول
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
