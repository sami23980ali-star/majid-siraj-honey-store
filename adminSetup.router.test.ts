import { beforeEach, describe, expect, it, vi } from "vitest";

const { OWNER_OPEN_ID, mocks } = vi.hoisted(() => ({
  OWNER_OPEN_ID: "owner-open-id-fixture",
  mocks: {
    hasCredential: vi.fn(),
    createCredential: vi.fn(),
  },
}));

vi.mock("./_core/env", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return { ENV: { ...actual.ENV, ownerOpenId: OWNER_OPEN_ID } };
});

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    hasLocalAdminCredential: mocks.hasCredential,
    createLocalAdminCredential: mocks.createCredential,
  };
});

import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

let requestCounter = 0;

function ownerContext() {
  // A fresh address per caller: adminAuth.setup is throttled per client, so a
  // shared address would make later cases fail on the budget rather than on the
  // guard they are testing.
  requestCounter += 1;
  return {
    user: { openId: OWNER_OPEN_ID, role: "user" } as TrpcContext["user"],
    localAdmin: null,
    req: { protocol: "https", headers: {}, ip: `198.51.100.${requestCounter}` } as unknown as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

describe("إعداد حساب المدير الأول", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasCredential.mockResolvedValue(false);
    mocks.createCredential.mockResolvedValue({ id: 1 });
  });

  // Regression guard: the setup screen used to submit only username + password
  // while the server required a phone, so the first owner account could never be
  // created and the dashboard stayed permanently unreachable.
  it("ينشئ حساب المالك عندما ترسل الواجهة الحقول التي يطلبها السيرفر", async () => {
    const caller = appRouter.createCaller(ownerContext());

    await expect(
      caller.adminAuth.setup({
        username: "Majid.Admin",
        password: "Majid-Store-2026!",
        phone: "+967 773-207-714",
        displayName: "ماجد سراج",
      }),
    ).resolves.toEqual({ success: true });

    expect(mocks.createCredential).toHaveBeenCalledTimes(1);
    expect(mocks.createCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        // Both values are normalized before they reach the database.
        username: "majid.admin",
        phone: "967773207714",
        displayName: "ماجد سراج",
        role: "owner",
      }),
    );
  });

  it("يرفض الإعداد بلا رقم هاتف", async () => {
    const caller = appRouter.createCaller(ownerContext());

    await expect(
      caller.adminAuth.setup({ username: "majid.admin", password: "Majid-Store-2026!" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createCredential).not.toHaveBeenCalled();
  });

  it("يرفض رقم هاتف بلا أي أرقام", async () => {
    const caller = appRouter.createCaller(ownerContext());

    await expect(
      caller.adminAuth.setup({ username: "majid.admin", password: "Majid-Store-2026!", phone: "---- ---" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createCredential).not.toHaveBeenCalled();
  });

  it("يمنع غير المالك من الإعداد ويمنع تكرار الإعداد", async () => {
    const strangerContext = { ...ownerContext(), user: { openId: "someone-else", role: "user" } as TrpcContext["user"] } as TrpcContext;
    await expect(
      appRouter.createCaller(strangerContext).adminAuth.setup({ username: "intruder.admin", password: "Intruder-2026!", phone: "773207714" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    mocks.hasCredential.mockResolvedValue(true);
    await expect(
      appRouter.createCaller(ownerContext()).adminAuth.setup({ username: "majid.admin", password: "Majid-Store-2026!", phone: "773207714" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.createCredential).not.toHaveBeenCalled();
  });

  // With an owner configured, the first-run claim belongs to that identity alone:
  // a signed-in stranger must not be offered the setup form at all.
  it("يتيح الإعداد للمالك المهيّأ فقط ويحجبه عن حساب موثّق آخر", async () => {
    // The owner proves ownership by identity, so no bootstrap token is asked of it.
    await expect(appRouter.createCaller(ownerContext()).adminAuth.status()).resolves.toMatchObject({ canSetup: true, ownerAdmin: true, requiresSetupToken: false });

    const strangerContext = { ...ownerContext(), user: { openId: "someone-else", role: "user" } as TrpcContext["user"] } as TrpcContext;
    await expect(appRouter.createCaller(strangerContext).adminAuth.status()).resolves.toMatchObject({ canSetup: false, ownerAdmin: false, requiresSetupToken: false });
  });

  // The owner path must not be weakened by the token check: a configured owner
  // creates the first account without ADMIN_SETUP_TOKEN existing at all.
  it("لا يطلب رمز إعداد من المالك المهيّأ", async () => {
    await expect(
      appRouter.createCaller(ownerContext()).adminAuth.setup({ username: "owner.only", password: "Owner-Only-2026!", phone: "773207714" }),
    ).resolves.toEqual({ success: true });
  });
});
