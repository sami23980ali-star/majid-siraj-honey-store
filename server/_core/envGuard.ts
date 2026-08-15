/**
 * Startup review of the environment.
 *
 * The failure this exists to prevent: `JWT_SECRET` has a silent `""` default, and
 * `sdk.getSessionSecret()` will happily sign session cookies with that empty key.
 * A production deploy that forgot the variable therefore boots, looks healthy,
 * and hands out forgeable owner sessions — the worst possible combination. A
 * missing `DATABASE_URL` announces itself as a 503 within seconds; this one
 * announces nothing at all, so it has to be checked here.
 *
 * Fatal findings apply in production only. Development keeps booting with an
 * empty environment on purpose: the storefront degrades to an empty catalog,
 * which is the intended way to work on the UI without a database.
 */

import { ENV } from "./env";

/** The shortest key worth signing with; shorter ones only earn a warning. */
export const MIN_SESSION_SECRET_LENGTH = 32;

export type EnvFinding = { variable: string; message: string };
export type EnvReport = { fatal: EnvFinding[]; warnings: EnvFinding[] };

export function reviewEnv(env: typeof ENV = ENV): EnvReport {
  const fatal: EnvFinding[] = [];
  const warnings: EnvFinding[] = [];
  // Outside production the same findings are advisory, so the storefront still
  // boots against an empty environment.
  const required = env.isProduction ? fatal : warnings;

  if (!env.cookieSecret) {
    required.push({
      variable: "JWT_SECRET",
      message: "غير مهيّأ: ستُوقَّع كوكيز الجلسة بمفتاح فارغ، ويمكن تزوير جلسة المالك. عيّن قيمة عشوائية طويلة.",
    });
  } else if (env.cookieSecret.length < MIN_SESSION_SECRET_LENGTH) {
    warnings.push({
      variable: "JWT_SECRET",
      message: `أقصر من ${MIN_SESSION_SECRET_LENGTH} حرفًا. استخدم قيمة عشوائية أطول.`,
    });
  }

  if (!env.databaseUrl) {
    warnings.push({ variable: "DATABASE_URL", message: "غير مهيّأ: الكتالوج يبقى فارغًا ولوحة الإدارة تجيب بـ 503." });
  }

  if (!env.oAuthServerUrl) {
    warnings.push({ variable: "OAUTH_SERVER_URL", message: "غير مهيّأ: دخول مالك المشروع لا يعمل." });
  }

  if (!env.forgeApiUrl || !env.forgeApiKey) {
    warnings.push({ variable: "BUILT_IN_FORGE_API_URL/KEY", message: "غير مهيّأ: مسار /manus-storage/* يجيب بـ 500 ولا تظهر صور المنتجات." });
  }

  // Mirrors canBootstrapLocalAdmin: with neither secret set, the setup screen
  // refuses everyone, so the store can never get its first admin account.
  if (!env.ownerOpenId && !env.adminSetupToken) {
    warnings.push({
      variable: "OWNER_OPEN_ID",
      message: "غير مهيّأ ولا يوجد ADMIN_SETUP_TOKEN: لن يستطيع أحد إنشاء أول حساب مدير.",
    });
  }

  // A live bootstrap secret is a standing key to the store; it is meant to be
  // deleted the moment the first account exists.
  if (env.adminSetupToken) {
    warnings.push({
      variable: "ADMIN_SETUP_TOKEN",
      message: "مهيّأ حاليًا: يتيح إنشاء أول حساب مدير لأي حساب موثّق يعرف الرمز. احذفه بعد إنشاء الحساب.",
    });
  }

  return { fatal, warnings };
}

export function formatEnvReport(report: EnvReport) {
  return [
    ...report.fatal.map(finding => `[env] FATAL ${finding.variable} — ${finding.message}`),
    ...report.warnings.map(finding => `[env] تحذير ${finding.variable} — ${finding.message}`),
  ];
}

/**
 * Logs every finding, then throws if any was fatal. Callers must let the throw
 * reach the process exit: booting past a fatal finding is the bug.
 */
export function assertEnvReady(env: typeof ENV = ENV, log: (line: string) => void = console.error) {
  const report = reviewEnv(env);
  for (const line of formatEnvReport(report)) log(line);
  if (report.fatal.length) {
    throw new Error(`تعذر الإقلاع: متغيّرات بيئة إلزامية غير مهيّأة (${report.fatal.map(finding => finding.variable).join(", ")}).`);
  }
  return report;
}
