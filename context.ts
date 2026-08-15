import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ADMIN_SESSION_COOKIE } from "../../shared/const";
import { hashAdminSessionToken } from "../adminAuth";
import { getLocalAdminSessionByTokenHash } from "../db";
import { sdk } from "./sdk";

export type LocalAdmin = {
  credentialId: number;
  username: string;
  displayName: string;
  role: "owner" | "manager" | "editor";
  expiresAt: Date;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  localAdmin: LocalAdmin | null;
};

function readCookie(cookieHeader: string | undefined, cookieName: string) {
  if (!cookieHeader) return undefined;
  const prefix = `${cookieName}=`;
  const cookie = cookieHeader.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return undefined;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let localAdmin: LocalAdmin | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  try {
    const sessionToken = readCookie(opts.req.headers.cookie, ADMIN_SESSION_COOKIE);
    if (sessionToken) localAdmin = (await getLocalAdminSessionByTokenHash(hashAdminSessionToken(sessionToken))) ?? null;
  } catch {
    localAdmin = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    localAdmin,
  };
}
