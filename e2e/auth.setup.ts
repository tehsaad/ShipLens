import { expect, test as setup } from "@playwright/test";
import { demoLogins } from "../prisma/seed/data";
import { DEMO_PASSWORD, ROLES, storageStateFor } from "./helpers";

// Signs in once per role through the login form and saves the session for the other tests.
for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(demoLogins[role]);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => url.pathname === "/admin");
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    await page.context().storageState({ path: storageStateFor(role) });
  });
}
