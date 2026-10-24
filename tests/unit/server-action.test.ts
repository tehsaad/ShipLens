import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { invalid, loadOrNotFound, routeId, runForm, submittedValues } from "@/lib/server-action";

/** Next.js marks notFound() with this digest; the framework renders the 404 page for it. */
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

function form(entries: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("server action helpers", () => {
  it("echoes typed text back, never passwords, files or framework fields", () => {
    expect(
      submittedValues(
        form({
          name: "Clifton",
          password: "hunter2-hunter2",
          newPassword: "x",
          $ACTION_ID_abc: "",
          upload: new Blob(["x"]),
        }),
      ),
    ).toEqual({ name: "Clifton" });
  });

  it("turns a Zod error into field errors on the form", () => {
    const schema = z.object({ name: z.string().min(2, "Too short.") });
    const result = schema.safeParse({ name: "x" });
    expect(result.success).toBe(false);
    expect(invalid(result.error!, form({ name: "x" }))).toEqual({
      error: "Check the highlighted fields.",
      fieldErrors: { name: ["Too short."] },
      values: { name: "x" },
    });
    expect(invalid(result.error!)).not.toHaveProperty("values");
  });

  it("shows an AppError on the form and lets anything else propagate", async () => {
    expect(await runForm(form({}), async () => "Saved.")).toEqual({
      error: null,
      success: "Saved.",
    });
    expect(await runForm(form({}), async () => undefined)).toEqual({
      error: null,
      success: null,
    });
    expect(
      await runForm(form({ amount: "5" }), async () => {
        throw new AppError("FORBIDDEN", "You do not have permission to do that.");
      }),
    ).toEqual({ error: "You do not have permission to do that.", values: { amount: "5" } });
    await expect(
      runForm(form({}), async () => {
        throw new Error("database exploded");
      }),
    ).rejects.toThrow("database exploded");
  });

  it("shows the 404 page for a missing record or a malformed id", async () => {
    expect(await loadOrNotFound(async () => "row")).toBe("row");
    await expect(
      loadOrNotFound(async () => {
        throw new AppError("NOT_FOUND", "Not found.");
      }),
    ).rejects.toMatchObject(NOT_FOUND);
    await expect(
      loadOrNotFound(async () => {
        throw new AppError("CONFLICT", "Changed.");
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const id = "0b6f2c1e-8d2a-4c51-9a0e-3f4b5c6d7e8f";
    expect(await routeId(Promise.resolve({ id }))).toBe(id);
    await expect(routeId(Promise.resolve({ id: "../users" }))).rejects.toMatchObject(NOT_FOUND);
  });
});
