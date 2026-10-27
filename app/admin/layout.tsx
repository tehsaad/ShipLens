import type { Metadata } from "next";
import type { ReactNode } from "react";
import { geist } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import "../globals.css";

export const metadata: Metadata = {
  title: { template: "%s · Admin · Hamqadam", default: "Admin · Hamqadam" },
  robots: { index: false, follow: false },
};

/** Root layout of the staff area. Admin screens are in English (section 7.4 covers navigation labels). */
export default function AdminRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
