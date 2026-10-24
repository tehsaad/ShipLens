import { expect, type Page } from "@playwright/test";
import { branches, collections, demoLogins, reports } from "../prisma/seed/data";

export type Role = keyof typeof demoLogins;

export const ROLES = Object.keys(demoLogins) as Role[];

/** The demo password of the throwaway E2E database (playwright.config.ts). */
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD!;

/** The signed-in browser state for a role, written by auth.setup.ts. */
export const storageStateFor = (role: Role) => `e2e/.auth/${role}.json`;

/** Opens a page and checks the HTTP status of the document itself. */
export async function expectPageStatus(page: Page, path: string, status: number): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), `GET ${path}`).toBe(status);
}

/** Calls a route handler (an export) with the page's session and checks its status. */
export async function expectRouteStatus(page: Page, path: string, status: number): Promise<void> {
  const response = await page.request.get(path, { maxRedirects: 0 });
  expect(response.status(), `GET ${path}`).toBe(status);
}

/** A seeded branch by code, for example "BR-LAH-001". */
export function seedBranch(code: string) {
  const branch = branches.find((candidate) => candidate.code === code);
  if (!branch) throw new Error(`No seeded branch ${code}`);
  return branch;
}

/** The seeded weekly report of a branch and week. */
export function seedReport(branchCode: string, weekStart: string) {
  const branchId = seedBranch(branchCode).id;
  const report = reports.find((r) => r.branchId === branchId && r.weekStart === weekStart);
  if (!report) throw new Error(`No seeded report for ${branchCode} ${weekStart}`);
  return report;
}

/** Any seeded collection of a branch. */
export function seedCollection(branchCode: string) {
  const branchId = seedBranch(branchCode).id;
  const collection = collections.find((c) => c.branchId === branchId);
  if (!collection) throw new Error(`No seeded collection for ${branchCode}`);
  return collection;
}
