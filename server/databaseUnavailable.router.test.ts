import { beforeEach, describe, expect, it, vi } from "vitest";

// A database outage must not be reported as an application bug. adminAuth.status
// is the sharpest case: the dashboard shell calls it before rendering anything,
// and while a dropped connection answered a bare 500 the shell read the missing
// payload as "no admin account exists yet" and offered the first-time setup
// screen to a store that already had an owner.
const mocks = vi.hoisted(() => ({ hasCredential: vi.fn(), listProducts: vi.fn() }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, hasLocalAdminCredential: mocks.hasCredential, listPublicProducts: mocks.listProducts };
});

import type { TrpcContext } from "./_core/context";
import { DatabaseUnavailableError, DATABASE_UNAVAILABLE_MESSAGE } from "./_core/errors";
import { appRouter } from "./routers";

const context = {
  user: null,
  localAdmin: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
} as TrpcContext;

describe("ترجمة تعذر الوصول إلى قاعدة البيانات", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasCredential.mockRejectedValue(new DatabaseUnavailableError());
    mocks.listProducts.mockRejectedValue(new DatabaseUnavailableError());
  });

  it("يجيب حالة الإدارة بـ 503 مع رسالة عربية واضحة بدل 500", async () => {
    await expect(appRouter.createCaller(context).adminAuth.status()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: DATABASE_UNAVAILABLE_MESSAGE,
    });
  });

  it("يطبّق الترجمة على الإجراءات العامة كذلك لا على مسار الإدارة وحده", async () => {
    await expect(appRouter.createCaller(context).catalog.list()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("لا يحوّل أخطاء التطبيق العادية إلى 503", async () => {
    mocks.hasCredential.mockRejectedValue(new Error("خطأ منطقي في التطبيق"));

    await expect(appRouter.createCaller(context).adminAuth.status()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
