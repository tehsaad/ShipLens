// The path-to-regexp copy bundled with Next.js, which next.config.ts `headers()` sources use.
// tests/unit/security-headers.test.ts checks the public CSP source against it.
declare module "next/dist/compiled/path-to-regexp" {
  export function pathToRegexp(path: string, keys?: unknown[], options?: object): RegExp;
}
