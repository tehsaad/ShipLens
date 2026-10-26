import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ur from "@/messages/ur.json";

/** Section 7.4: both message files have the same keys (and the same ICU placeholders). */
function flatten(value: unknown, prefix = ""): Map<string, unknown> {
  const result = new Map<string, unknown>();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, leaf] of flatten(child, prefix ? `${prefix}.${key}` : key)) {
        result.set(path, leaf);
      }
    }
  } else {
    result.set(prefix, value);
  }
  return result;
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)[,}]/g)].map((match) => match[1]).sort();

describe("messages/en.json and messages/ur.json", () => {
  const english = flatten(en);
  const urdu = flatten(ur);

  it("have the same keys", () => {
    expect([...urdu.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("have no empty translations", () => {
    for (const [key, value] of urdu) {
      expect(value, key).not.toEqual("");
    }
  });

  it("have every public Urdu text translated, not left in English", () => {
    // The admin area is in English by decision (section 7.4 covers navigation labels only).
    // The language switcher's Urdu label names the other language, English, in English.
    const englishOnPurpose = new Set(["language.switchTo"]);
    const texts = [...urdu].filter(
      (entry): entry is [string, string] =>
        !entry[0].startsWith("admin.") && typeof entry[1] === "string",
    );
    for (const [key, value] of texts) {
      if (englishOnPurpose.has(key)) continue;
      expect(value, key).not.toBe(english.get(key));
      expect(value, key).toMatch(/[\u0600-\u06FF]/);
    }
    for (const [key, value] of urdu) {
      if (!Array.isArray(value)) continue;
      value.forEach((paragraph: unknown, index) => {
        expect(paragraph, `${key}[${index}]`).toMatch(/[\u0600-\u06FF]/);
        expect(paragraph, `${key}[${index}]`).not.toBe((english.get(key) as unknown[])[index]);
      });
    }
  });

  it("use the same placeholders and list lengths", () => {
    for (const [key, value] of english) {
      const other = urdu.get(key);
      if (typeof value === "string") {
        expect(placeholders(other as string), key).toEqual(placeholders(value));
      } else if (Array.isArray(value)) {
        expect((other as unknown[]).length, key).toBe(value.length);
      }
    }
  });
});

describe("public form errors", () => {
  it("only use keys that exist in both message files", async () => {
    const { applicationSchema, contactSchema } = await import("@/lib/validation/applications");
    const keys = new Set<string>();
    const collect = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
      result.error?.issues.forEach((issue) => keys.add(issue.message));
    // Empty, too-long and malformed values reach every rule.
    for (const value of ["", "x".repeat(3000)]) {
      collect(
        applicationSchema.safeParse({
          fullName: value,
          email: value,
          phone: value,
          preferredBranchId: value,
          skills: value,
          availability: value,
          motivation: value,
          consentGiven: false,
        }),
      );
      collect(contactSchema.safeParse({ name: value, email: value, message: value }));
    }
    expect(keys.size).toBeGreaterThanOrEqual(12);
    for (const key of keys) {
      expect(en.errors, key).toHaveProperty(key);
      expect(ur.errors, key).toHaveProperty(key);
    }
  });
});
