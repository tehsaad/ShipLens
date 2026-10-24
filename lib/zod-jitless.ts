import { z } from "zod";

/**
 * Zod compiles object parsers with `new Function` when eval is allowed, and probes for it on
 * first use. The site's CSP forbids eval, so in the browser the probe only produces a CSP
 * violation report; turning the compiler off keeps the console clean (section 8, A05).
 * Imported first by the client components that validate with Zod.
 */
z.config({ jitless: true });
