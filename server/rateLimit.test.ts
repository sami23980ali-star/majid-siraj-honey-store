import { describe, expect, it } from "vitest";
import { createRateLimiter, formatRetryAfter } from "./_core/rateLimit";

describe("محدّد المعدل", () => {
  it("يسمح بالعدد المسموح ثم يرفض ما يزيد عنه", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const start = 1_000_000;

    expect(limiter.check("ip-a", start).allowed).toBe(true);
    expect(limiter.check("ip-a", start + 10).allowed).toBe(true);
    const third = limiter.check("ip-a", start + 20);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const rejected = limiter.check("ip-a", start + 30);
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterMs).toBeGreaterThan(0);
  });

  it("يعزل كل مفتاح عن الآخر", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const start = 2_000_000;

    expect(limiter.check("ip-a", start).allowed).toBe(true);
    expect(limiter.check("ip-a", start + 1).allowed).toBe(false);
    // A different client must still have its full budget.
    expect(limiter.check("ip-b", start + 1).allowed).toBe(true);
  });

  it("يفتح النافذة مرة أخرى بعد انقضاء مدتها", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000 });
    const start = 3_000_000;

    expect(limiter.check("ip-a", start).allowed).toBe(true);
    expect(limiter.check("ip-a", start + 100).allowed).toBe(true);
    expect(limiter.check("ip-a", start + 200).allowed).toBe(false);
    expect(limiter.check("ip-a", start + 10_001).allowed).toBe(true);
  });

  it("لا يمدّد النافذة عند استمرار المحاولات المرفوضة", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000 });
    const start = 4_000_000;

    expect(limiter.check("ip-a", start).allowed).toBe(true);
    // Hammering during the window must not push the reset time further out.
    for (let offset = 1; offset < 10_000; offset += 1_000) {
      expect(limiter.check("ip-a", start + offset).allowed).toBe(false);
    }
    expect(limiter.check("ip-a", start + 10_001).allowed).toBe(true);
  });

  it("يحدّ عدد المفاتيح المتتبعة حتى لا تتضخم الذاكرة", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 10 });
    for (let index = 0; index < 200; index += 1) {
      limiter.check(`ip-${index}`, 5_000_000 + index);
    }
    expect(limiter.size()).toBeLessThanOrEqual(10);
  });

  it("يصيغ مدة الانتظار بالعربية", () => {
    expect(formatRetryAfter(1_000)).toBe("دقيقة واحدة");
    expect(formatRetryAfter(9 * 60_000)).toBe("9 دقائق");
  });
});
