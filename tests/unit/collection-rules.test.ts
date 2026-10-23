import { describe, expect, it } from "vitest";
import { amountError, collectionLockReason, correctedTotalIsValid } from "@/lib/rules/collection";

describe("collection lock (section 6.3)", () => {
  const lockedAt = new Date("2026-10-20T10:00:00Z");

  it("is editable before lockedAt when the week is not approved", () => {
    expect(collectionLockReason(lockedAt, false, new Date("2026-10-20T09:59:59Z"))).toBeNull();
  });

  it("locks at exactly lockedAt", () => {
    expect(collectionLockReason(lockedAt, false, lockedAt)).toBe("LOCKED");
  });

  it("locks when the week's report is approved", () => {
    expect(collectionLockReason(lockedAt, true, new Date("2026-10-19T00:00:00Z"))).toBe(
      "WEEK_APPROVED",
    );
  });
});

describe("amounts (amendment A1)", () => {
  it("requires normal entries to be positive", () => {
    expect(amountError("10.00", false)).toBeNull();
    expect(amountError("0.00", false)).not.toBeNull();
    expect(amountError("-1.00", false)).not.toBeNull();
  });

  it("allows corrections of either sign but not zero", () => {
    expect(amountError("-10.00", true)).toBeNull();
    expect(amountError("10.00", true)).toBeNull();
    expect(amountError("0.00", true)).not.toBeNull();
  });

  it("keeps the corrected total at or above zero", () => {
    expect(correctedTotalIsValid(["100.00", "-40.00", "-60.00"])).toBe(true);
    expect(correctedTotalIsValid(["100.00", "-40.00", "-60.01"])).toBe(false);
    expect(correctedTotalIsValid(["100.00", "25.00", "-125.00"])).toBe(true);
  });
});
