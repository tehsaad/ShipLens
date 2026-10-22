import "server-only";
import { hash, verify } from "@node-rs/argon2";

// The package's Algorithm enum is an ambient const enum, which isolatedModules cannot read.
const ARGON2ID = 2;

// Argon2id with the OWASP-recommended baseline (19 MiB memory, 2 iterations, 1 lane).
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed stored hash is treated as a failed match, never as an error page.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real check when the account does not exist, so response
 * times do not reveal which email addresses have accounts.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  await verifyPassword(await dummyHash, password);
  return false;
}
