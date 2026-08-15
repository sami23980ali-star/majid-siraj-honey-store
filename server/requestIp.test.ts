import { describe, expect, it } from "vitest";
import { getClientIp, getRateLimitKey } from "./_core/requestIp";

describe("استخراج عنوان العميل", () => {
  it("يفضّل العنوان الذي حسبه express على الترويسة القابلة للتزوير", () => {
    // With `trust proxy` configured, req.ip is the address express derived from
    // the hops it trusts. A client that prepends its own x-forwarded-for entry
    // must not be able to override it.
    const ip = getClientIp({
      ip: "203.0.113.9",
      headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" },
    });
    expect(ip).toBe("203.0.113.9");
  });

  it("يعود إلى مقبس الاتصال ثم إلى الترويسة عند غياب req.ip", () => {
    expect(getClientIp({ headers: {}, socket: { remoteAddress: "198.51.100.7" } })).toBe("198.51.100.7");
    expect(getClientIp({ headers: { "x-forwarded-for": "198.51.100.8, 10.0.0.1" } })).toBe("198.51.100.8");
  });

  it("يقبل الترويسة كمصفوفة ويقصّ القيم الطويلة", () => {
    expect(getClientIp({ headers: { "x-forwarded-for": ["198.51.100.9", "10.0.0.2"] } })).toBe("198.51.100.9");
    const long = getClientIp({ headers: { "x-forwarded-for": "x".repeat(500) } });
    expect(long).toHaveLength(64);
  });

  it("يعيد undefined عند غياب كل المصادر", () => {
    expect(getClientIp({ headers: {} })).toBeUndefined();
    expect(getClientIp({ ip: "   ", headers: {} })).toBeUndefined();
  });

  it("ينتج مفتاحًا غير فارغ لكل نطاق حتى بلا عنوان", () => {
    expect(getRateLimitKey({ ip: "203.0.113.9", headers: {} }, "orders.create")).toBe("orders.create:203.0.113.9");
    expect(getRateLimitKey({ headers: {} }, "orders.create")).toBe("orders.create:unknown");
  });
});
