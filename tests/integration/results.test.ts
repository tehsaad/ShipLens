import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import {
  createResult,
  getResult,
  getResultImage,
  listPublishedResults,
  listResults,
  setResultImage,
  setResultStatus,
  updateResult,
} from "@/lib/services/results";
import type { ResultInput } from "@/lib/validation/results";
import { contextFor, createActor } from "./helpers/context";
import { createTestPrisma } from "./helpers/prisma";
import { createBranch, pool } from "./helpers/sql";

let prisma: PrismaClient;
let admin: Actor;

beforeAll(async () => {
  prisma = createTestPrisma();
  admin = await createActor("SUPER_ADMIN");
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

const base: Omit<ResultInput, "branchId"> = {
  titleEn: "A result",
  titleUr: null,
  bodyEn: "What the branch achieved.",
  bodyUr: null,
  happenedOn: null,
};

describe("results (public portfolio)", () => {
  it("keeps a branch lead to its own branch", async () => {
    const branchA = await createBranch();
    const branchB = await createBranch();
    const leadA = await createActor("BRANCH_LEAD", branchA);

    // The branch in the form is ignored: a branch lead always writes for its own branch.
    const own = await createResult(contextFor(prisma, leadA), { ...base, branchId: branchB });
    const stored = await prisma.result.findUniqueOrThrow({
      where: { id: own.id },
      select: { branchId: true },
    });
    expect(stored.branchId).toBe(branchA);

    // Another branch's result, and a network-level result, are reported as not found.
    const other = await createResult(contextFor(prisma, admin), { ...base, branchId: branchB });
    const network = await createResult(contextFor(prisma, admin), { ...base, branchId: null });
    for (const id of [other.id, network.id]) {
      await expect(getResult(contextFor(prisma, leadA), id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        updateResult(contextFor(prisma, leadA), id, { ...base, branchId: null }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(setResultStatus(contextFor(prisma, leadA), id, true)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }

    const list = await listResults(contextFor(prisma, leadA));
    expect(list.every((result) => result.branchId === branchA)).toBe(true);
  });

  it("publishes, lists publicly and stores an image with alt text", async () => {
    const created = await createResult(contextFor(prisma, admin), {
      ...base,
      titleEn: "Visible result",
      branchId: null,
    });

    expect((await listPublishedResults(prisma)).some((r) => r.id === created.id)).toBe(false);
    await setResultStatus(contextFor(prisma, admin), created.id, true);
    expect((await listPublishedResults(prisma)).some((r) => r.id === created.id)).toBe(true);

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await setResultImage(contextFor(prisma, admin), created.id, {
      data: png,
      contentType: "image/png",
      byteSize: png.length,
      altEn: "A photo of the drive",
      altUr: null,
    });
    const image = await getResultImage(prisma, created.id);
    expect(image?.contentType).toBe("image/png");
    expect(image?.status).toBe("PUBLISHED");
    const row = await prisma.result.findUniqueOrThrow({
      where: { id: created.id },
      select: { imageAltEn: true, imageUpdatedAt: true },
    });
    expect(row.imageAltEn).toBe("A photo of the drive");
    expect(row.imageUpdatedAt).not.toBeNull();
  });

  it("refuses a role that cannot manage results", async () => {
    const finance = await createActor("FINANCE_REVIEWER");
    await expect(
      createResult(contextFor(prisma, finance), { ...base, branchId: null }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
