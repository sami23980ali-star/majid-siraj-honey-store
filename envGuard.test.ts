import { describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { assertEnvReady, MIN_SESSION_SECRET_LENGTH, reviewEnv } from "./_core/envGuard";

const LONG_SECRET = "s".repeat(MIN_SESSION_SECRET_LENGTH);

function envWith(overrides: Partial<typeof ENV>) {
  return {
    ...ENV,
    cookieSecret: LONG_SECRET,
    databaseUrl: "mysql://user:pass@host:3306/db",
    oAuthServerUrl: "https://oauth.example",
    forgeApiUrl: "https://forge.example",
    forgeApiKey: "forge-key",
    ownerOpenId: "owner-open-id",
    adminSetupToken: "",
    isProduction: true,
    ...overrides,
  } as typeof ENV;
}

function variables(findings: Array<{ variable: string }>) {
  return findings.map(finding => finding.variable);
}

describe("envGuard", () => {
  it("لا يبلّغ عن شيء عندما تكون البيئة مكتملة", () => {
    const report = reviewEnv(envWith({}));

    expect(report.fatal).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  // The whole reason this guard exists: an empty JWT_SECRET signs session
  // cookies with an empty key, so owner sessions become forgeable in silence.
  it("يعدّ غياب JWT_SECRET خطأ قاتلًا في الإنتاج", () => {
    const report = reviewEnv(envWith({ cookieSecret: "" }));

    expect(variables(report.fatal)).toEqual(["JWT_SECRET"]);
    expect(report.fatal[0].message).toContain("تزوير");
  });

  // Local work without any .env has to keep booting: the storefront degrades to
  // an empty catalog on purpose.
  it("يخفّض غياب JWT_SECRET إلى تحذير خارج الإنتاج", () => {
    const report = reviewEnv(envWith({ cookieSecret: "", isProduction: false }));

    expect(report.fatal).toEqual([]);
    expect(variables(report.warnings)).toContain("JWT_SECRET");
  });

  it("يحذّر من مفتاح جلسة أقصر من الحد الأدنى دون منع الإقلاع", () => {
    const report = reviewEnv(envWith({ cookieSecret: "short-secret" }));

    expect(report.fatal).toEqual([]);
    expect(variables(report.warnings)).toContain("JWT_SECRET");
  });

  it("يحذّر من الخدمات الناقصة دون منع الإقلاع", () => {
    const report = reviewEnv(envWith({ databaseUrl: "", oAuthServerUrl: "", forgeApiKey: "" }));

    expect(report.fatal).toEqual([]);
    expect(variables(report.warnings)).toEqual(["DATABASE_URL", "OAUTH_SERVER_URL", "BUILT_IN_FORGE_API_URL/KEY"]);
  });

  // Mirrors canBootstrapLocalAdmin: neither secret means the setup screen refuses
  // everyone, so the store could never get a first admin.
  it("يحذّر عندما يتعذر إنشاء أول حساب مدير بغياب السرّين", () => {
    const report = reviewEnv(envWith({ ownerOpenId: "", adminSetupToken: "" }));

    expect(variables(report.warnings)).toContain("OWNER_OPEN_ID");
  });

  it("يحذّر من بقاء رمز الإعداد مهيّأً", () => {
    const report = reviewEnv(envWith({ adminSetupToken: "setup-token-fixture" }));

    expect(variables(report.warnings)).toContain("ADMIN_SETUP_TOKEN");
  });

  it("يرفع استثناءً عند وجود خطأ قاتل ويسجّل كل النتائج", () => {
    const log = vi.fn();

    expect(() => assertEnvReady(envWith({ cookieSecret: "", databaseUrl: "" }), log)).toThrow(/JWT_SECRET/);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("FATAL JWT_SECRET"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"));
  });

  it("يعيد التقرير دون استثناء عندما تكون النتائج تحذيرات فقط", () => {
    const log = vi.fn();

    const report = assertEnvReady(envWith({ databaseUrl: "" }), log);

    expect(report.fatal).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
