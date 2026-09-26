import type { DB } from "@/db";

/** An error whose message is safe to show to the end user. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

export const newId = () => crypto.randomUUID();

/** Quantities are numeric(18,4); keep JS arithmetic on the same grid. */
export const roundQty = (n: number) => Math.round(n * 10_000) / 10_000;

export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

export function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
