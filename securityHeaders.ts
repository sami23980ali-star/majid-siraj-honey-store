/**
 * Security response headers, written by hand instead of pulling in `helmet`,
 * so the hardening ships without adding a runtime dependency to the template.
 *
 * The CSP is deliberately split by environment: Vite's dev server injects
 * inline module preloads and needs `unsafe-inline`/`unsafe-eval`, while the
 * production bundle does not. Sources that must stay open in both:
 *   - fonts.googleapis.com / fonts.gstatic.com — client/src/index.css imports
 *     the Alexandria + Amiri families at the top of the file.
 *   - https: for img/media — /manus-storage/* answers with a 307 redirect to a
 *     presigned S3 host whose domain is not known at build time.
 *   - VITE_ANALYTICS_ENDPOINT — the umami tag in client/index.html.
 */

import type { NextFunction, Request, Response } from "express";

const FONT_STYLE_SRC = "https://fonts.googleapis.com";
const FONT_FILE_SRC = "https://fonts.gstatic.com";

function analyticsOrigin(): string | null {
  const raw = process.env.VITE_ANALYTICS_ENDPOINT;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(isProduction: boolean): string {
  const analytics = analyticsOrigin();
  const scriptSrc = ["'self'"];
  if (analytics) scriptSrc.push(analytics);
  // Vite's dev transform emits inline scripts and uses eval for HMR-less module
  // rewriting; the built bundle needs neither.
  if (!isProduction) scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");

  const connectSrc = ["'self'"];
  if (analytics) connectSrc.push(analytics);
  if (!isProduction) connectSrc.push("ws:", "wss:");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Tailwind injects style elements at runtime, so inline styles stay allowed.
    `style-src 'self' 'unsafe-inline' ${FONT_STYLE_SRC}`,
    `font-src 'self' data: ${FONT_FILE_SRC}`,
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    `connect-src ${connectSrc.join(" ")}`,
    // The store never embeds third-party frames, and must never be embedded.
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function securityHeaders(isProduction: boolean) {
  const csp = buildContentSecurityPolicy(isProduction);

  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Security-Policy", csp);
    // Redundant with frame-ancestors for modern browsers, kept for older ones.
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );

    // Only advertise HSTS on connections that actually arrived over TLS —
    // sending it over plain HTTP is ignored by browsers and misleading in logs.
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protoList = Array.isArray(forwardedProto)
      ? forwardedProto
      : forwardedProto?.split(",") ?? [];
    const isHttps =
      req.protocol === "https" ||
      protoList.some(proto => proto.trim().toLowerCase() === "https");
    if (isProduction && isHttps) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    // Admin surfaces and the storage proxy must never sit in a shared cache.
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
    }

    next();
  };
}
