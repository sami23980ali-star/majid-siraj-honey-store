/**
 * Infrastructure failures that are not the caller's fault.
 *
 * `DatabaseUnavailableError` exists so the data layer can refuse a request
 * without importing tRPC: `server/_core/trpc.ts` translates it into a
 * SERVICE_UNAVAILABLE (503) response. Before that translation every dropped
 * database connection surfaced as a bare INTERNAL_SERVER_ERROR (500) with a
 * stack trace, which reads to a client as "this app is broken" rather than
 * "this dependency is down, retrying may work".
 */
export const DATABASE_UNAVAILABLE_MESSAGE = "قاعدة البيانات غير متاحة حاليًا";

export class DatabaseUnavailableError extends Error {
  constructor(message: string = DATABASE_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * Matches across module instances and through wrapper errors. `instanceof` alone
 * is not enough: tRPC re-wraps a thrown error and puts the original on `cause`.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth++) {
    if (current instanceof DatabaseUnavailableError) return true;
    if (typeof current === "object" && (current as { name?: string }).name === "DatabaseUnavailableError") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
