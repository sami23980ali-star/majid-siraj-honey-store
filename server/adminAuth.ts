import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

export const ADMIN_MAX_FAILED_ATTEMPTS = 5;
export const ADMIN_LOCK_DURATION_MS = 10 * 60 * 1000;
export const ADMIN_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

type PasswordParts = {
  salt: string;
  digest: string;
};

function readPasswordHash(value: string): PasswordParts | null {
  const [algorithm, iterations, keyLength, salt, digest] = value.split("$");
  if (algorithm !== "pbkdf2-sha512" || iterations !== "210000" || keyLength !== "64" || !salt || !digest) return null;
  return { salt, digest };
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const digest = await pbkdf2Async(password, salt, 210_000, 64, "sha512");
  return `pbkdf2-sha512$210000$64$${salt}$${digest.toString("hex")}`;
}

export async function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = readPasswordHash(storedHash);
  if (!parts) return false;
  const digest = await pbkdf2Async(password, parts.salt, 210_000, 64, "sha512");
  const expected = Buffer.from(parts.digest, "hex");
  return expected.length === digest.length && timingSafeEqual(expected, digest);
}

export function normalizeAdminUsername(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeAdminPhone(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function createAdminSessionToken() {
  return randomBytes(48).toString("base64url");
}

export function hashAdminSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isAdminLocked(lockedUntil: Date | null, now = new Date()) {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

/**
 * Constant-time check of the one-time bootstrap secret. An empty expected value
 * (ADMIN_SETUP_TOKEN unset) or an empty submission never matches, so a missing
 * configuration can never be satisfied by a missing input.
 */
export function matchesAdminSetupToken(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const given = Buffer.from(provided, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export function getLockUntilAfterFailure(failedAttemptsBefore: number, now = new Date()) {
  return failedAttemptsBefore + 1 >= ADMIN_MAX_FAILED_ATTEMPTS
    ? new Date(now.getTime() + ADMIN_LOCK_DURATION_MS)
    : null;
}

export function getRemainingAttempts(failedAttempts: number) {
  return Math.max(0, ADMIN_MAX_FAILED_ATTEMPTS - failedAttempts);
}
