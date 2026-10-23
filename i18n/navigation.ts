import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link, redirect and pathname helpers for the public site. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
