import { describe, expect, it, vi } from "vitest";
import { securityHeaders } from "./_core/securityHeaders";

type Captured = { headers: Record<string, string>; nextCalls: number };

function run(isProduction: boolean, request: { protocol?: string; path?: string; headers?: Record<string, string | string[] | undefined> } = {}): Captured {
  const headers: Record<string, string> = {};
  const next = vi.fn();
  const req = { protocol: request.protocol ?? "http", path: request.path ?? "/", headers: request.headers ?? {} };
  const res = { setHeader: (name: string, value: string) => { headers[name] = value; } };

  securityHeaders(isProduction)(req as never, res as never, next as never);
  return { headers, nextCalls: next.mock.calls.length };
}

describe("رؤوس الأمان", () => {
  it("يضبط الرؤوس الأساسية ويمرر الطلب", () => {
    const { headers, nextCalls } = run(true);

    expect(nextCalls).toBe(1);
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });

  it("يسمح بخطوط جوجل والوسائط الموقّعة التي يستخدمها المتجر فعلًا", () => {
    const csp = run(true).headers["Content-Security-Policy"];

    // client/src/index.css imports Alexandria + Amiri from Google Fonts.
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
    // /manus-storage/* redirects to a presigned host unknown at build time.
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("media-src 'self' blob: https:");
  });

  it("لا يسمح بـ unsafe-eval في الإنتاج ويسمح به للتطوير فقط", () => {
    expect(run(true).headers["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(run(false).headers["Content-Security-Policy"]).toContain("unsafe-eval");
  });

  it("يرسل HSTS فقط للإنتاج عبر اتصال مشفّر", () => {
    expect(run(true, { protocol: "https" }).headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(run(true, { headers: { "x-forwarded-proto": "https,http" } }).headers["Strict-Transport-Security"]).toBeDefined();
    // Plain HTTP and development builds must not advertise HSTS.
    expect(run(true, { protocol: "http" }).headers["Strict-Transport-Security"]).toBeUndefined();
    expect(run(false, { protocol: "https" }).headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("يمنع تخزين ردود الـ API في أي وسيط", () => {
    expect(run(true, { path: "/api/trpc/admin.orders" }).headers["Cache-Control"]).toBe("no-store");
    expect(run(true, { path: "/shop" }).headers["Cache-Control"]).toBeUndefined();
  });
});
