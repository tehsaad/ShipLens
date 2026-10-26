import { readFileSync } from "node:fs";
import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import { renderPermissionsDoc } from "@/lib/permissions-doc";

describe("docs/permissions.md", () => {
  it("matches the permission matrix (run `npm run docs:permissions` after changing it)", async () => {
    const path = "docs/permissions.md";
    const options = await resolveConfig(path);
    const expected = await format(renderPermissionsDoc(), { ...options, filepath: path });
    expect(readFileSync(path, "utf8")).toBe(expected);
  });

  it("shows scopes as the matrix defines them", () => {
    const doc = renderPermissionsDoc();
    expect(doc).toMatch(/\| `audit\.read` \| All \| — \| — \| — \| — \| {2}\|/);
    expect(doc).toMatch(/\| `collection\.create` \| — \| — \| — \| — \| Own branch \| {2}\|/);
    expect(doc).toMatch(/\| `application\.submit` \| All \| All \| All \| All \| All \| Yes \|/);
  });
});
