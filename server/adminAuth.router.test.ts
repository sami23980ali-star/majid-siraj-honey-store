import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getCredential: vi.fn(),
  getCredentialById: vi.fn(),
  getSessionByHash: vi.fn(),
  hasCredential: vi.fn(),
  registerAttempt: vi.fn(),
  registerFailure: vi.fn(),
  resetLoginState: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createLocalAdminSession: mocks.createSession,
    deleteLocalAdminSession: mocks.deleteSession,
    getLocalAdminCredential: mocks.getCredential,
    getLocalAdminCredentialById: mocks.getCredentialById,
    getLocalAdminSessionByTokenHash: mocks.getSessionByHash,
    hasLocalAdminCredential: mocks.hasCredential,
    registerLocalAdminLoginAttempt: mocks.registerAttempt,
    registerLocalAdminFailure: mocks.registerFailure,
    resetLocalAdminLoginState: mocks.resetLoginState,
    updateLocalAdminPassword: mocks.updatePassword,
  };
});

import { ADMIN_SESSION_COOKIE } from "../shared/const";
import { hashAdminPassword, hashAdminSessionToken } from "./adminAuth";
import { createContext, type TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function createCallerContext(cookieHeader?: string) {
  const cookies: Array<{ name: string; value?: string; options: Record<string, unknown> }> = [];
  const ctx = {
    user: null,
    localAdmin: null,
    req: { protocol: "https", headers: cookieHeader ? { cookie: cookieHeader } : {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: (name: string, options: Record<string, unknown>) => cookies.push({ name, options }),
    } as TrpcContext["res"],
  } as TrpcContext;
  return { ctx, cookies };
}

describe("adminAuth router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasCredential.mockResolvedValue(true);
    mocks.createSession.mockResolvedValue(undefined);
    mocks.deleteSession.mockResolvedValue(undefined);
    mocks.registerAttempt.mockResolvedValue(undefined);
    mocks.resetLoginState.mockResolvedValue(undefined);
    mocks.updatePassword.mockResolvedValue(undefined);
  });

  it("يقفل مسار الدخول بعد المحاولة الخامسة غير الصحيحة لمدة عشر دقائق", async () => {
    const credential = {
      id: 7,
      username: "majid.admin",
      displayName: "ماجد المدير",
      passwordHash: await hashAdminPassword("Majid-Store-2026!"),
      phone: null,
      role: "owner" as const,
      isActive: 1,
      createdByCredentialId: null,
      failedAttempts: 0,
      lockedUntil: null as Date | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.getCredential.mockImplementation(async () => credential);
    mocks.registerFailure.mockImplementation(async (_current, lockedUntil) => {
      credential.failedAttempts = lockedUntil ? 0 : credential.failedAttempts + 1;
      credential.lockedUntil = lockedUntil;
    });
    const { ctx } = createCallerContext();
    const caller = appRouter.createCaller(ctx);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(caller.adminAuth.login({ username: "majid.admin", password: "incorrect-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(caller.adminAuth.login({ username: "majid.admin", password: "incorrect-password" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(credential.lockedUntil?.getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    await expect(caller.adminAuth.login({ username: "majid.admin", password: "Majid-Store-2026!" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("يحذف كوكي المدير والجلسة المقابلة عند تسجيل الخروج", async () => {
    const { ctx, cookies } = createCallerContext(`${ADMIN_SESSION_COOKIE}=opaque-local-token`);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.adminAuth.logout()).resolves.toEqual({ success: true });
    expect(mocks.deleteSession).toHaveBeenCalledTimes(1);
    expect(cookies).toContainEqual(expect.objectContaining({ name: ADMIN_SESSION_COOKIE, options: expect.objectContaining({ maxAge: -1, httpOnly: true, secure: true, sameSite: "lax" }) }));
  });

  it("يستخرج جلسة المدير المحلية من الكوكي داخل سياق الطلب", async () => {
    mocks.getSessionByHash.mockResolvedValue({ credentialId: 7, username: "majid.admin", displayName: "ماجد المدير", role: "owner", expiresAt: new Date(Date.now() + 60_000) });
    const context = await createContext({
      req: { protocol: "https", headers: { cookie: `${ADMIN_SESSION_COOKIE}=opaque-local-token` } } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });

    expect(context.localAdmin).toMatchObject({ credentialId: 7, username: "majid.admin" });
    expect(mocks.getSessionByHash).toHaveBeenCalledTimes(1);
  });

  it("يعزل جلستي مستخدمين محليين مختلفين وفق رمز الجلسة", async () => {
    const ownerSession = { credentialId: 7, username: "store.owner", displayName: "مالك المتجر", role: "owner" as const, expiresAt: new Date(Date.now() + 60_000) };
    const editorSession = { credentialId: 8, username: "catalog.editor", displayName: "محرر المحتوى", role: "editor" as const, expiresAt: new Date(Date.now() + 60_000) };
    mocks.getSessionByHash.mockImplementation(async (tokenHash: string) => tokenHash === hashAdminSessionToken("owner-token") ? ownerSession : tokenHash === hashAdminSessionToken("editor-token") ? editorSession : undefined);
    const [ownerContext, editorContext] = await Promise.all([
      createContext({ req: { protocol: "https", headers: { cookie: `${ADMIN_SESSION_COOKIE}=owner-token` } } as TrpcContext["req"], res: {} as TrpcContext["res"] }),
      createContext({ req: { protocol: "https", headers: { cookie: `${ADMIN_SESSION_COOKIE}=editor-token` } } as TrpcContext["req"], res: {} as TrpcContext["res"] }),
    ]);
    expect(ownerContext.localAdmin).toMatchObject({ credentialId: 7, role: "owner" });
    expect(editorContext.localAdmin).toMatchObject({ credentialId: 8, role: "editor" });
    expect(ownerContext.localAdmin?.credentialId).not.toBe(editorContext.localAdmin?.credentialId);
  });

  it("يغيّر كلمة مرور المدير بعد التحقق من الحالية ويلغي جلسته المحلية", async () => {
    const credential = {
      id: 7,
      username: "majid.admin",
      displayName: "ماجد المدير",
      passwordHash: await hashAdminPassword("Old-Password-2026!"),
      phone: null,
      role: "owner" as const,
      isActive: 1,
      createdByCredentialId: null,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.getCredentialById.mockResolvedValue(credential);
    const { ctx, cookies } = createCallerContext();
    ctx.localAdmin = { credentialId: 7, username: "majid.admin", displayName: "ماجد المدير", role: "owner", expiresAt: new Date(Date.now() + 60_000) };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.adminAuth.changeOwnPassword({ currentPassword: "Old-Password-2026!", newPassword: "New-Password-2026!" })).resolves.toEqual({ success: true });
    expect(mocks.updatePassword).toHaveBeenCalledWith(7, expect.any(String));
    expect(cookies).toContainEqual(expect.objectContaining({ name: ADMIN_SESSION_COOKIE, options: expect.objectContaining({ maxAge: -1 }) }));
    await expect(caller.adminAuth.changeOwnPassword({ currentPassword: "خطأ-غير-صحيح", newPassword: "Another-Password-2026!" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
