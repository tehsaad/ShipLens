/**
 * Writes docs/permissions.md from the permission matrix (`npm run docs:permissions`), formatted
 * with the project's Prettier settings so the drift test compares like with like.
 */
import { writeFileSync } from "node:fs";
import { format, resolveConfig } from "prettier";
import { renderPermissionsDoc } from "../lib/permissions-doc";

const path = "docs/permissions.md";
const options = await resolveConfig(path);
writeFileSync(path, await format(renderPermissionsDoc(), { ...options, filepath: path }));
console.log(`Wrote ${path}`);
