import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Session cookie policy for both the OAuth session and the local admin session.
 *
 * Defaults to `sameSite: "lax"` — the cookie must not ride along on cross-site
 * requests. With `"none"` (the previous hardcoded value) every state-changing
 * tRPC mutation was one permissive CORS header away from being forgeable, and
 * browsers additionally drop a `SameSite=None` cookie that is not `Secure`,
 * which silently broke local admin login over plain HTTP. "lax" still sends the
 * cookie on top-level navigations, so the OAuth redirect back from the portal
 * keeps working. Set SESSION_COOKIE_SAMESITE=none to restore the old behaviour
 * when the app is embedded in a third-party iframe.
 *
 * `secure` is forced on in production even if the proxy fails to advertise TLS,
 * and always on with `sameSite: "none"`, which browsers reject without it.
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const sameSite = ENV.sessionCookieSameSite;
  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure: sameSite === "none" || ENV.isProduction || isSecureRequest(req),
  };
}
