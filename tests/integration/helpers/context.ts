import type { PrismaClient, Role } from "@/lib/generated/prisma/client";
import type { Actor } from "@/lib/permissions";
import type { ServiceContext } from "@/lib/services/shared";
import { createUser } from "./sql";

export const TEST_REQUEST = { ipAddress: "127.0.0.1", userAgent: "vitest" };

export function contextFor(db: PrismaClient, actor: Actor, now?: Date): ServiceContext {
  return { db, actor, request: TEST_REQUEST, ...(now ? { now } : {}) };
}

/** A user row with the role (and branch), returned as a permission-check actor. */
export async function createActor(role: Role, branchId: string | null = null): Promise<Actor> {
  return { id: await createUser(role, branchId), role, branchId };
}
