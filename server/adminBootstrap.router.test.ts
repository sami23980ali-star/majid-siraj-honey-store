import { beforeEach, describe, expect, it, vi } from "vitest";

// This suite is the mirror image of adminSetup.router.test.ts: there OWNER_OPEN_ID
// is configured, here it is empty. With no owner identity to match against, the
// claim must rest on the ADMIN_SETUP_TOKEN secret — never on the mere absence of
// configuration, which used to hand the store to whichever authenticated visitor
// reached /admin first.
const mocks = vi.hoisted(() => ({
  hasCredential: vi.fn(),
  createCredential: vi.fn(),
  env: { ownerOpenId: "", adminSetupToken: "" },
}));

vi.mock("./_core/env", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  // A live getter, so each test can set the token the router reads at call time.
  return {
    ENV: {
      ...actual.ENV,
      get ownerOpenId() { return mocks.env.ownerOpenId; },
      get adminSetupToken() { return mocks.env.adminSetupToken; },
    },
  };
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

const SETUP_TOKEN = "setup-token-fixture-9f2c41";

let requestCounter = 0;

function contextFor(user: TrpcContext["user"]) {
  // A fresh address per caller: adminAuth.setup is throttled per client, and the
  // refusal tests would otherwise spend the budget the success tests need.
  requestCounter += 1;
  return {
    user,
    localAdmin: null,
    req: { protocol: "https", headers: { "x-forwarded-for": `203.0.113.${requestCounter}` }, ip: `203.0.113.${requestCounter}` } as unknown as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

const visitor = { openId: "first-signed-in-account", role: "user" } as TrpcContext["user"];

describe("مطالبة إعداد المدير برمز الإعداد", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasCredential.mockResolvedValue(false);
    mocks.createCredential.mockResolvedValue({ id: 1 });
    mocks.env.ownerOpenId = "";
    mocks.env.adminSetupToken = SETUP_TOKEN;
  });

  it("يعلن إتاحة الإعداد مع طلب الرمز لحساب موثّق عندما لا يوجد مالك مهيّأ", async () => {
    const status = await appRouter.createCaller(contextFor(visitor)).adminAuth.status();

    expect(status).toMatchObject({ configured: false, ownerAdmin: false, canSetup: true, requiresSetupToken: true });
  });

  // The regression this whole suite exists to prevent: with neither secret set,
  // an unconfigured deployment must refuse everyone rather than be claimable.
  it("يحجب الإعداد تمامًا عندما لا يوجد مالك مهيّأ ولا رمز إعداد", async () => {
    mocks.env.adminSetupToken = "";

    const status = await appRouter.createCaller(contextFor(visitor)).adminAuth.status();
    expect(status).toMatchObject({ canSetup: false, requiresSetupToken: false });

    await expect(
      appRouter.createCaller(contextFor(visitor)).adminAuth.setup({ username: "squatter.admin", password: "Squatter-2026!", phone: "773207714" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createCredential).not.toHaveBeenCalled();
  });

  it("لا يتيح الإعداد لزائر غير مسجّل", async () => {
    const status = await appRouter.createCaller(contextFor(null)).adminAuth.status();

    expect(status.canSetup).toBe(false);
    await expect(
      appRouter.createCaller(contextFor(null)).adminAuth.setup({ username: "anon.admin", password: "Anon-Store-2026!", phone: "773207714", setupToken: SETUP_TOKEN }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.createCredential).not.toHaveBeenCalled();
  });

  it("يرفض الإعداد بلا رمز أو برمز خاطئ", async () => {
    await expect(
      appRouter.createCaller(contextFor(visitor)).adminAuth.setup({ username: "no.token", password: "No-Token-2026!", phone: "773207714" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      appRouter.createCaller(contextFor(visitor)).adminAuth.setup({ username: "bad.token", password: "Bad-Token-2026!", phone: "773207714", setupToken: `${SETUP_TOKEN}x` }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mocks.createCredential).not.toHaveBeenCalled();
  });

  it("ينشئ أول حساب مالك محلي من حساب موثّق يكتب الرمز الصحيح", async () => {
    await expect(
      appRouter.createCaller(contextFor(visitor)).adminAuth.setup({
        username: "Majid.Admin",
        password: "Majid-Store-2026!",
        phone: "+967 773-207-714",
        displayName: "ماجد سراج",
        setupToken: SETUP_TOKEN,
      }),
    ).resolves.toEqual({ success: true });

    expect(mocks.createCredential).toHaveBeenCalledWith(
      expect.objectContaining({ username: "majid.admin", phone: "967773207714", role: "owner" }),
    );
  });

  it("يقفل المطالبة نهائيًا بعد إنشاء أول حساب ولا يمنح الحساب نفسه صلاحية مالك", async () => {
    mocks.hasCredential.mockResolvedValue(true);
    const caller = appRouter.createCaller(contextFor(visitor));

    const status = await caller.adminAuth.status();
    // The claiming identity keeps no privilege of its own: it must sign in with
    // the local username and password it just created.
    expect(status).toMatchObject({ configured: true, canSetup: false, ownerAdmin: false, requiresSetupToken: false });
    await expect(
      caller.adminAuth.setup({ username: "second.admin", password: "Second-Store-2026!", phone: "773207714", setupToken: SETUP_TOKEN }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createCredential).not.toHaveBeenCalled();
  });
});
