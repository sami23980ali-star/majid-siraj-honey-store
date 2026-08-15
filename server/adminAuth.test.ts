import { describe, expect, it } from "vitest";
import { ADMIN_LOCK_DURATION_MS, ADMIN_MAX_FAILED_ATTEMPTS, getLockUntilAfterFailure, getRemainingAttempts, hashAdminPassword, isAdminLocked, matchesAdminSetupToken, normalizeAdminPhone, normalizeAdminUsername, verifyAdminPassword } from "./adminAuth";

describe("adminAuth", () => {
  // An unset ADMIN_SETUP_TOKEN must never be satisfiable, in particular not by an
  // omitted field arriving as the empty string.
  it("يطابق رمز الإعداد فقط عند تساوي قيمتين غير فارغتين", () => {
    expect(matchesAdminSetupToken("setup-token-fixture", "setup-token-fixture")).toBe(true);
    expect(matchesAdminSetupToken("setup-token-fixture", "setup-token-fixtur")).toBe(false);
    expect(matchesAdminSetupToken("setup-token-fixturex", "setup-token-fixture")).toBe(false);
    expect(matchesAdminSetupToken("", "")).toBe(false);
    expect(matchesAdminSetupToken("anything", "")).toBe(false);
    expect(matchesAdminSetupToken("", "setup-token-fixture")).toBe(false);
  });
  it("يحفظ كلمة المرور بصيغة مشتقة ويتحقق منها دون حفظ النص الأصلي", async () => {
    const password = "Majid-Store-2026!";
    const hash = await hashAdminPassword(password);

    expect(hash).not.toContain(password);
    await expect(verifyAdminPassword(password, hash)).resolves.toBe(true);
    await expect(verifyAdminPassword("incorrect-password", hash)).resolves.toBe(false);
  });

  it("يقفل الحساب لمدة عشر دقائق عند المحاولة الخاطئة الخامسة", () => {
    const now = new Date("2026-08-12T00:00:00.000Z");
    expect(ADMIN_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(getLockUntilAfterFailure(3, now)).toBeNull();

    const lockedUntil = getLockUntilAfterFailure(4, now);
    expect(lockedUntil?.getTime()).toBe(now.getTime() + ADMIN_LOCK_DURATION_MS);
    expect(isAdminLocked(lockedUntil!, new Date(now.getTime() + ADMIN_LOCK_DURATION_MS - 1))).toBe(true);
    expect(isAdminLocked(lockedUntil!, new Date(now.getTime() + ADMIN_LOCK_DURATION_MS))).toBe(false);
  });

  it("يعرض عدد المحاولات المتبقية ويطبع المعرف والهاتف بصيغة مستقرة", () => {
    expect(getRemainingAttempts(0)).toBe(5);
    expect(getRemainingAttempts(4)).toBe(1);
    expect(getRemainingAttempts(5)).toBe(0);
    expect(normalizeAdminUsername("  Majid.Admin ")).toBe("majid.admin");
    expect(normalizeAdminPhone("+967 773-207-714")).toBe("967773207714");
  });
});
